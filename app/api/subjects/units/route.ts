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
    subjectId?: string;
    units?: number;
  } | null;
  if (
    !body?.subjectId ||
    typeof body.units !== "number" ||
    !Number.isFinite(body.units) ||
    body.units < 0.5 ||
    !Number.isInteger(body.units * 2) ||
    body.units > 30
  )
    return NextResponse.json(
      { error: "Course units must be between 0.5 and 30." },
      { status: 400 },
    );
  const { error } = await supabase
    .from("subjects")
    .update({ units: body.units })
    .eq("id", body.subjectId)
    .eq("user_id", user.id);
  return error
    ? NextResponse.json({ error: error.message }, { status: 502 })
    : NextResponse.json({ units: body.units });
}
