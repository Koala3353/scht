import { NextResponse } from "next/server";
import { z } from "zod";

import { decryptCredentials, encryptCredentials } from "../../../../../lib/integrations/credentials";
import { gmailTaskFilters, gmailTaskListQuery, messageMatchesGmailTaskFilters } from "../../../../../lib/integrations/gmail-filters";
import { formatRetryAfter, GoogleApiError, googleApi, googleErrorKind, googleErrorMessage, googleRetryAfter, refreshGoogleCredential, type GoogleCredential } from "../../../../../lib/integrations/google";
import { createClient } from "../../../../../lib/supabase/server";

export type ServiceState = "synced" | "degraded" | "needs_reauth";
export type ServiceResult = { state: ServiceState; imported: number; message: string };
export type GoogleSyncResult = { calendar: ServiceResult; gmail: ServiceResult };

type CalendarEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink?: string };
type GmailMessage = { id: string; snippet?: string; labelIds?: string[]; payload?: { headers?: Array<{ name: string; value: string }> } };
const googleCredentialSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

function bytes(value: unknown) {
  if (typeof value === "string") return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64");
  return Buffer.from(value as Uint8Array);
}

function serviceFailure(error: unknown, service: "Google Calendar" | "Gmail", imported = 0): ServiceResult {
  const kind = googleErrorKind(error);
  const state: ServiceState = kind === "needs_reauth" || kind === "permission" ? "needs_reauth" : "degraded";
  if (kind === "rate_limited") {
    const time = formatRetryAfter(googleRetryAfter(error));
    return {
      state,
      imported,
      message: service === "Gmail"
        ? `Gmail is temporarily rate-limited. Your Calendar update is safe; try Gmail again after ${time}.`
        : `Google Calendar is temporarily rate-limited. Try again after ${time}.`,
    };
  }
  return { state, imported, message: googleErrorMessage(error, service) };
}

function credentialFailure(error: unknown): GoogleSyncResult {
  const kind = googleErrorKind(error);
  const state: ServiceState = kind === "needs_reauth" || kind === "permission" ? "needs_reauth" : "degraded";
  const message = kind === "rate_limited"
    ? `Google authorization refresh is temporarily rate-limited. Try again after ${formatRetryAfter(googleRetryAfter(error))}.`
    : googleErrorMessage(error, "Google authorization refresh");
  const service = { state, imported: 0, message };
  return { calendar: service, gmail: { ...service } };
}

function connectionSettings(value: unknown, result: GoogleSyncResult) {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  return {
    ...(parsed.success ? parsed.data : {}),
    sync: {
      calendar: { ...result.calendar, recordedAt: new Date().toISOString() },
      gmail: { ...result.gmail, recordedAt: new Date().toISOString() },
    },
  };
}

async function gmailMetadata(credentials: GoogleCredential, ids: string[]) {
  const messages: GmailMessage[] = [];
  let failure: unknown = null;
  let next = 0;
  const worker = async () => {
    while (failure === null) {
      const index = next;
      next += 1;
      if (index >= ids.length) return;
      try {
        messages.push(await googleApi<GmailMessage>(credentials, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ids[index]}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, "Gmail"));
      } catch (error) {
        failure = error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, ids.length) }, () => worker()));
  return { messages, failure };
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("current_term_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not read your current term." }, { status: 502 });

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, encrypted_credentials, settings")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (connectionError) return NextResponse.json({ error: "Could not read your Google connection." }, { status: 502 });
  if (!connection?.encrypted_credentials) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });

  let credentials: GoogleCredential;
  try {
    const credentialResult = googleCredentialSchema.safeParse(decryptCredentials(bytes(connection.encrypted_credentials)));
    if (!credentialResult.success) throw new GoogleApiError("needs_reauth", "Google authorization has expired. Reconnect Google and try again.");
    credentials = credentialResult.data;
    if (credentials.expiresAt && new Date(credentials.expiresAt) <= new Date()) credentials = await refreshGoogleCredential(credentials);
  } catch (error) {
    const result = credentialFailure(error);
    const needsReauth = result.calendar.state === "needs_reauth" || result.gmail.state === "needs_reauth";
    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({ status: needsReauth ? "error" : "connected", error_message: needsReauth ? result.gmail.message : null, settings: connectionSettings(connection.settings, result) })
      .eq("id", connection.id);
    if (updateError) return NextResponse.json({ error: "Google connection needs to be reconnected, but the connection result could not be saved." }, { status: 502 });
    return NextResponse.json(result);
  }

  const calendarWork = (async (): Promise<ServiceResult> => {
    try {
      const now = new Date();
      const calendar = await googleApi<{ items?: CalendarEvent[] }>(credentials, `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(now.toISOString())}&maxResults=100`, "Google Calendar");
      const events = (calendar.items ?? []).map((event) => ({
        user_id: user.id,
        provider: "google_calendar",
        source_id: event.id,
        title: event.summary || "Untitled calendar event",
        starts_at: event.start?.dateTime ?? event.start?.date ?? null,
        ends_at: event.end?.dateTime ?? event.end?.date ?? null,
        is_all_day: Boolean(event.start?.date && !event.start?.dateTime),
        event_url: event.htmlLink ?? null,
      }));
      if (events.length) {
        const { error } = await supabase.from("calendar_events").upsert(events, { onConflict: "user_id,provider,source_id" });
        if (error) throw new Error("Could not save Google Calendar events.");
      }
      return { state: "synced", imported: events.length, message: `${events.length} Calendar events imported.` };
    } catch (error) {
      return serviceFailure(error, "Google Calendar");
    }
  })();

  const gmailWork = (async (): Promise<ServiceResult> => {
    if (!profile?.current_term_id) return { state: "degraded", imported: 0, message: "Select a current term before importing Gmail review tasks." };
    try {
      const filters = gmailTaskFilters((connection.settings as Record<string, unknown> | null)?.gmailTaskFilters);
      const listing = await googleApi<{ messages?: Array<{ id: string }> }>(credentials, `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(gmailTaskListQuery())}`, "Gmail");
      const metadata = await gmailMetadata(credentials, (listing.messages ?? []).map((message) => message.id));
      const tasks = metadata.messages.filter((message) => messageMatchesGmailTaskFilters(message, filters)).map((message) => ({
        user_id: user.id,
        source: "gmail",
        source_id: message.id,
        title: message.payload?.headers?.find((header) => header.name.toLowerCase() === "subject")?.value || "Unread Gmail message",
        kind: "personal",
        priority: "normal",
        term_id: profile.current_term_id,
        notes: message.snippet ?? null,
      }));
      if (tasks.length) {
        // Ignore existing source identities so a provider refresh never overwrites a user's task context or description.
        const { data: savedTasks, error } = await supabase
          .from("tasks")
          .upsert(tasks, { onConflict: "user_id,source,source_id", ignoreDuplicates: true })
          .select("id");
        if (error) throw new Error("Could not save Gmail review tasks.");
        const imported = savedTasks?.length ?? 0;
        if (metadata.failure) return serviceFailure(metadata.failure, "Gmail", imported);
        return { state: "synced", imported, message: `${imported} Gmail tasks imported.` };
      }
      if (metadata.failure) return serviceFailure(metadata.failure, "Gmail");
      return { state: "synced", imported: 0, message: "0 Gmail tasks imported." };
    } catch (error) {
      return serviceFailure(error, "Gmail");
    }
  })();

  const [calendar, gmail] = await Promise.all([calendarWork, gmailWork]);
  const result: GoogleSyncResult = { calendar, gmail };
  const bothSynced = calendar.state === "synced" && gmail.state === "synced";
  const needsReauth = calendar.state === "needs_reauth" || gmail.state === "needs_reauth";
  const { error: updateError } = await supabase
    .from("integration_connections")
    .update({
      status: needsReauth ? "error" : "connected",
      encrypted_credentials: encryptCredentials({ accessToken: credentials.accessToken, ...(credentials.refreshToken ? { refreshToken: credentials.refreshToken } : {}), ...(credentials.expiresAt ? { expiresAt: credentials.expiresAt } : {}) }),
      settings: connectionSettings(connection.settings, result),
      ...(bothSynced ? { last_synced_at: new Date().toISOString() } : {}),
      error_message: needsReauth ? (calendar.state === "needs_reauth" ? calendar.message : gmail.message) : null,
    })
    .eq("id", connection.id);
  if (updateError) return NextResponse.json({ error: "Google data imported, but the connection result could not be saved." }, { status: 502 });
  return NextResponse.json(result);
}
