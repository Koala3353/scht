import { NextResponse } from "next/server";
import { z } from "zod";

import { decryptCredentials, encryptCredentials } from "../../../../../lib/integrations/credentials";
import { gmailTaskFilters, gmailTaskListQuery, messageMatchesGmailTaskFilters } from "../../../../../lib/integrations/gmail-filters";
import { formatRetryAfter, GoogleApiError, googleApi, googleErrorKind, googleErrorMessage, googleRetryAfter, refreshGoogleCredential, type GoogleCredential } from "../../../../../lib/integrations/google";
import { createClient } from "../../../../../lib/supabase/server";

export type ServiceState = "synced" | "degraded" | "needs_reauth";
export type ServiceResult = { state: ServiceState; imported: number; message: string };
export type GoogleSyncResult = { calendar: ServiceResult; gmail: ServiceResult };
export type GoogleAccountSyncResult = GoogleSyncResult & { accountEmail: string | null };

type CalendarEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink?: string };
type GmailMessage = { id: string; snippet?: string; labelIds?: string[]; payload?: { headers?: Array<{ name: string; value: string }> } };
type Connection = { id: string; account_email: string | null; encrypted_credentials: unknown; settings: unknown };
const credentialSchema = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1).optional(), expiresAt: z.string().datetime().optional() });

function bytes(value: unknown) { return typeof value === "string" ? (value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64")) : Buffer.from(value as Uint8Array); }
function sourceId(connectionId: string, providerId: string) { return `${connectionId}:${providerId}`; }
function settings(value: unknown, result: GoogleSyncResult) { const parsed = z.record(z.string(), z.unknown()).safeParse(value); return { ...(parsed.success ? parsed.data : {}), sync: { calendar: { ...result.calendar, recordedAt: new Date().toISOString() }, gmail: { ...result.gmail, recordedAt: new Date().toISOString() } } }; }

function failed(error: unknown, service: "Google Calendar" | "Gmail", imported = 0): ServiceResult {
  const kind = googleErrorKind(error);
  const state: ServiceState = kind === "needs_reauth" || kind === "permission" ? "needs_reauth" : "degraded";
  if (kind === "rate_limited") return {
    state,
    imported,
    message: service === "Gmail"
      ? `Gmail is temporarily rate-limited. Your Calendar update is safe; try Gmail again after ${formatRetryAfter(googleRetryAfter(error))}.`
      : `Google Calendar is temporarily rate-limited. Try again after ${formatRetryAfter(googleRetryAfter(error))}.`,
  };
  return { state, imported, message: googleErrorMessage(error, service) };
}

function credentialFailure(error: unknown): GoogleSyncResult { const kind = googleErrorKind(error); const state: ServiceState = kind === "needs_reauth" || kind === "permission" ? "needs_reauth" : "degraded"; const message = kind === "rate_limited" ? `Google authorization refresh is temporarily rate-limited. Try again after ${formatRetryAfter(googleRetryAfter(error))}.` : googleErrorMessage(error, "Google authorization refresh"); return { calendar: { state, imported: 0, message }, gmail: { state, imported: 0, message } }; }

async function gmailMetadata(credentials: GoogleCredential, ids: string[]) {
  const messages: GmailMessage[] = []; let failure: unknown = null; let next = 0;
  const worker = async () => { while (failure === null) { const index = next++; if (index >= ids.length) return; try { messages.push(await googleApi<GmailMessage>(credentials, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ids[index]}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, "Gmail")); } catch (error) { failure = error; } } };
  await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker));
  return { messages, failure };
}

async function syncConnection(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, termId: string | null, connection: Connection): Promise<GoogleAccountSyncResult> {
  let credentials: GoogleCredential;
  try {
    const parsed = credentialSchema.safeParse(decryptCredentials(bytes(connection.encrypted_credentials)));
    if (!parsed.success) throw new GoogleApiError("needs_reauth", "Google authorization has expired. Reconnect Google and try again.");
    credentials = parsed.data;
    if (credentials.expiresAt && new Date(credentials.expiresAt) <= new Date()) credentials = await refreshGoogleCredential(credentials);
  } catch (error) {
    const result = credentialFailure(error); const needsReauth = result.calendar.state === "needs_reauth";
    await supabase.from("integration_connections").update({ status: needsReauth ? "error" : "connected", error_message: needsReauth ? result.gmail.message : null, settings: settings(connection.settings, result) }).eq("id", connection.id);
    return { accountEmail: connection.account_email, ...result };
  }
  const calendar = await (async (): Promise<ServiceResult> => { try {
    const now = new Date(); const response = await googleApi<{ items?: CalendarEvent[] }>(credentials, `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(now.toISOString())}&maxResults=100`, "Google Calendar");
    const events = (response.items ?? []).map((event) => ({ user_id: userId, provider: "google_calendar", source_id: sourceId(connection.id, event.id), title: event.summary || "Untitled calendar event", starts_at: event.start?.dateTime ?? event.start?.date ?? null, ends_at: event.end?.dateTime ?? event.end?.date ?? null, is_all_day: Boolean(event.start?.date && !event.start?.dateTime), event_url: event.htmlLink ?? null }));
    if (events.length) { const { error } = await supabase.from("calendar_events").upsert(events, { onConflict: "user_id,provider,source_id" }); if (error) throw new Error("Could not save Google Calendar events."); }
    return { state: "synced", imported: events.length, message: `${events.length} Calendar events imported.` };
  } catch (error) { return failed(error, "Google Calendar"); } })();
  const gmail = await (async (): Promise<ServiceResult> => { if (!termId) return { state: "degraded", imported: 0, message: "Select a current term before importing Gmail review tasks." }; try {
    const filters = gmailTaskFilters((connection.settings as Record<string, unknown> | null)?.gmailTaskFilters);
    const listing = await googleApi<{ messages?: Array<{ id: string }> }>(credentials, `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(gmailTaskListQuery())}`, "Gmail");
    const metadata = await gmailMetadata(credentials, (listing.messages ?? []).map((message) => message.id));
    const tasks = metadata.messages.filter((message) => messageMatchesGmailTaskFilters(message, filters)).map((message) => ({ user_id: userId, source: "gmail", source_id: sourceId(connection.id, message.id), title: message.payload?.headers?.find((header) => header.name.toLowerCase() === "subject")?.value || "Unread Gmail message", kind: "personal", priority: "normal", term_id: termId, notes: message.snippet ?? null }));
    let imported = 0; if (tasks.length) { const { data, error } = await supabase.from("tasks").upsert(tasks, { onConflict: "user_id,source,source_id", ignoreDuplicates: true }).select("id"); if (error) throw new Error("Could not save Gmail review tasks."); imported = data?.length ?? 0; }
    return metadata.failure ? failed(metadata.failure, "Gmail", imported) : { state: "synced", imported, message: `${imported} Gmail tasks imported.` };
  } catch (error) { return failed(error, "Gmail"); } })();
  const result = { calendar, gmail }; const needsReauth = calendar.state === "needs_reauth" || gmail.state === "needs_reauth";
  await supabase.from("integration_connections").update({ status: needsReauth ? "error" : "connected", encrypted_credentials: encryptCredentials({ accessToken: credentials.accessToken, ...(credentials.refreshToken ? { refreshToken: credentials.refreshToken } : {}), ...(credentials.expiresAt ? { expiresAt: credentials.expiresAt } : {}) }), settings: settings(connection.settings, result), ...(calendar.state === "synced" && gmail.state === "synced" ? { last_synced_at: new Date().toISOString() } : {}), error_message: needsReauth ? (calendar.state === "needs_reauth" ? calendar.message : gmail.message) : null }).eq("id", connection.id);
  return { accountEmail: connection.account_email, ...result };
}

function aggregate(results: GoogleAccountSyncResult[], service: "calendar" | "gmail"): ServiceResult {
  const items = results.map((result) => result[service]);
  if (items.length === 1) return items[0];
  const imported = items.reduce((sum, item) => sum + item.imported, 0);
  const state: ServiceState = items.some((item) => item.state === "needs_reauth") ? "needs_reauth" : items.some((item) => item.state === "degraded") ? "degraded" : "synced";
  const label = service === "calendar" ? "Calendar events" : "Gmail tasks";
  const reconnecting = items.filter((item) => item.state === "needs_reauth").length;
  const retrying = items.filter((item) => item.state === "degraded").length;
  const attention = reconnecting ? ` ${reconnecting} account${reconnecting === 1 ? " needs" : "s need"} reconnecting.` : retrying ? ` ${retrying} account${retrying === 1 ? " is" : "s are"} temporarily unavailable.` : "";
  return { state, imported, message: `${imported} ${label} imported from ${results.length} Google accounts.${attention}` };
}

export async function POST() {
  const supabase = await createClient(); const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const [{ data: profile, error: profileError }, { data: connections, error: connectionError }] = await Promise.all([
    supabase.from("profiles").select("current_term_id").eq("id", user.id).maybeSingle(),
    supabase.from("integration_connections").select("id, account_email, encrypted_credentials, settings").eq("user_id", user.id).eq("provider", "google"),
  ]);
  if (profileError || connectionError) return NextResponse.json({ error: "Could not read your Google connections." }, { status: 502 });
  const usable = (connections ?? []).filter((connection) => connection.encrypted_credentials) as Connection[];
  if (!usable.length) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });
  const accounts = await Promise.all(usable.map((connection) => syncConnection(supabase, user.id, profile?.current_term_id ?? null, connection)));
  return NextResponse.json({ calendar: aggregate(accounts, "calendar"), gmail: aggregate(accounts, "gmail"), accounts });
}
