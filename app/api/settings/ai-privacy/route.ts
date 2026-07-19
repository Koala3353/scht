import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ connectedDataOptIn: z.boolean() });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose whether AI may use connected data." }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .update({ ai_connected_data_opt_in: parsed.data.connectedDataOptIn })
    .eq("id", user.id);
  return error
    ? NextResponse.json({ error: "Could not save your AI privacy choice." }, { status: 502 })
    : NextResponse.json({ connectedDataOptIn: parsed.data.connectedDataOptIn });
}
