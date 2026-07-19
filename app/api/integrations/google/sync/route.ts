import { NextResponse } from "next/server";

import { decryptCredentials, encryptCredentials } from "../../../../../lib/integrations/credentials";
import { googleApi, refreshGoogleCredential, type GoogleCredential } from "../../../../../lib/integrations/google";
import { createClient } from "../../../../../lib/supabase/server";

function bytes(value: unknown) {
  if (typeof value === "string") return value.startsWith("\\x") ? Buffer.from(value.slice(2), "hex") : Buffer.from(value, "base64");
  return Buffer.from(value as Uint8Array);
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Google sync failed.";
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("current_term_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not read your current term." }, { status: 502 });

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, encrypted_credentials")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (connectionError) return NextResponse.json({ error: "Could not read your Google connection." }, { status: 502 });
  if (!connection?.encrypted_credentials) return NextResponse.json({ error: "Connect Google first." }, { status: 400 });

  try {
    let credentials = decryptCredentials(bytes(connection.encrypted_credentials)) as unknown as GoogleCredential;
    if (credentials.expiresAt && new Date(credentials.expiresAt) <= new Date()) credentials = await refreshGoogleCredential(credentials);
    const now = new Date();
    const [calendar, messages] = await Promise.all([
      googleApi<{ items?: Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink?: string }> }>(credentials, "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=" + encodeURIComponent(now.toISOString()) + "&maxResults=100", "Google Calendar"),
      googleApi<{ messages?: Array<{ id: string }> }>(credentials, "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25&q=is%3Aunread", "Gmail"),
    ]);
    const events = (calendar.items ?? []).map((event) => ({
      user_id: user.id,
      provider: "google_calendar",
      source_id: event.id,
      title: event.summary || "Untitled calendar event",
      starts_at: event.start?.dateTime ?? event.start?.date ?? null,
      ends_at: event.end?.dateTime ?? event.end?.date ?? null,
      is_all_day: Boolean(event.start?.date && !event.start?.dateTime),
      event_url: event.htmlLink ?? null,
      raw: event,
    }));
    if (events.length) {
      const { error } = await supabase.from("calendar_events").upsert(events, { onConflict: "user_id,provider,source_id" });
      if (error) throw new Error("Could not save Google Calendar events.");
    }
    const messageDetails = await Promise.all((messages.messages ?? []).map((message) => googleApi<{ id: string; snippet?: string; payload?: { headers?: Array<{ name: string; value: string }> } }>(credentials, "https://gmail.googleapis.com/gmail/v1/users/me/messages/" + message.id + "?format=metadata&metadataHeaders=Subject", "Gmail")));
    const tasks = messageDetails.map((message) => ({
      user_id: user.id,
      source: "gmail",
      source_id: message.id,
      title: message.payload?.headers?.find((header) => header.name.toLowerCase() === "subject")?.value || "Unread Gmail message",
      kind: "personal",
      priority: "normal",
      term_id: profile?.current_term_id ?? null,
      notes: message.snippet ?? null,
    }));
    if (tasks.length) {
      const { error } = await supabase.from("tasks").upsert(tasks, { onConflict: "user_id,source,source_id" });
      if (error) throw new Error("Could not save Gmail review tasks.");
    }
    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({
        status: "connected",
        encrypted_credentials: encryptCredentials({ accessToken: credentials.accessToken, ...(credentials.refreshToken ? { refreshToken: credentials.refreshToken } : {}), ...(credentials.expiresAt ? { expiresAt: credentials.expiresAt } : {}) }),
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", connection.id);
    if (updateError) throw new Error("Google data imported, but the connection status could not be updated.");
    return NextResponse.json({ calendarEvents: events.length, gmailTasks: tasks.length });
  } catch (error) {
    const message = messageFor(error);
    await supabase.from("integration_connections").update({ status: "error", error_message: message }).eq("id", connection.id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
