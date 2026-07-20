import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "../../../../../lib/supabase/server";

const phrase = z.string().trim().min(1).max(120);
const filtersSchema = z.object({
  taskTriggers: z.array(phrase).min(1).max(30),
  excludedPhrases: z.array(phrase).max(30),
  includedCategories: z.object({
    promotions: z.boolean(),
    social: z.boolean(),
    updates: z.boolean(),
  }).strict(),
}).strict();

function connectionSettings(value: unknown, filters: z.infer<typeof filtersSchema>) {
  const parsed = z.record(z.string(), z.unknown()).safeParse(value);
  return {
    ...(parsed.success ? parsed.data : {}),
    gmailTaskFilters: filters,
  };
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = filtersSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add at least one task trigger; each phrase must be 120 characters or less." }, { status: 400 });

  const filters = {
    taskTriggers: [...new Set(parsed.data.taskTriggers.map((entry) => entry.toLowerCase()))],
    excludedPhrases: [...new Set(parsed.data.excludedPhrases.map((entry) => entry.toLowerCase()))],
    includedCategories: parsed.data.includedCategories,
  };
  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, settings")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (connectionError || !connection) return NextResponse.json({ error: "Connect Google before saving Gmail task filters." }, { status: 400 });

  const { error } = await supabase
    .from("integration_connections")
    .update({ settings: connectionSettings(connection.settings, filters) })
    .eq("id", connection.id);
  return error
    ? NextResponse.json({ error: "Could not save Gmail task filters." }, { status: 502 })
    : NextResponse.json({ filters });
}
