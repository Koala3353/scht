import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  subjectId: z.string().uuid(),
  hidden: z.boolean(),
});

/** Archive a Canvas course without deleting its assignments, syllabus, or grades. */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid course visibility change." }, { status: 400 });

  const { data, error } = await supabase
    .from("subjects")
    .update({ archived_at: parsed.data.hidden ? new Date().toISOString() : null })
    .eq("id", parsed.data.subjectId)
    .eq("user_id", user.id)
    .not("canvas_course_id", "is", null)
    .select("id, archived_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not update this course's visibility." }, { status: 502 });
  if (!data) return NextResponse.json({ error: "That Canvas course is unavailable." }, { status: 404 });
  return NextResponse.json({ hidden: Boolean(data.archived_at) });
}
