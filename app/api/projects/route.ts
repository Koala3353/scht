import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const projectId = z.string().uuid();
const projectName = z.string().trim().min(1).max(120);
const status = z.enum(["active", "archived"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = projectName.safeParse((await request.json().catch(() => null) as { name?: unknown } | null)?.name);
  if (!parsed.success) return NextResponse.json({ error: "Project names must be between 1 and 120 characters." }, { status: 400 });
  const { data, error } = await supabase.from("projects").insert({ user_id: user.id, name: parsed.data, status: "active" }).select("id, name, status").single();
  return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json({ project: data }, { status: 201 });
}

const mutationSchema = z.object({ projectId, name: projectName.optional(), status: status.optional() })
  .refine((value) => value.name || value.status, "Choose a project change.");

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use a valid project or task selection." }, { status: 400 });
  const body = parsed.data;

  const changes = { ...(body.name ? { name: body.name } : {}), ...(body.status ? { status: body.status } : {}) };
  const { data, error } = await supabase.from("projects").update(changes).eq("id", body.projectId).eq("user_id", user.id).select("id, name, status").maybeSingle();
  return error ? NextResponse.json({ error: error.message }, { status: 502 }) : data ? NextResponse.json({ project: data }) : NextResponse.json({ error: "Project not found." }, { status: 404 });
}
