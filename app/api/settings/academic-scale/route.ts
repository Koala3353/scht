import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const body = (await request.json().catch(() => null)) as {
    academicScale?: unknown;
  } | null;
  if (body?.academicScale !== "qpi" && body?.academicScale !== "gpa")
    return NextResponse.json({ error: "Choose QPI or GPA." }, { status: 400 });
  const { error } = await supabase
    .from("profiles")
    .update({ academic_scale: body.academicScale })
    .eq("id", user.id);
  return error
    ? NextResponse.json({ error: error.message }, { status: 502 })
    : NextResponse.json({ academicScale: body.academicScale });
}
