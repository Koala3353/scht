import { NextResponse } from "next/server";
import { extractCandidateWeights } from "@/lib/syllabus/weights";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

async function extractSyllabusText(file: File) {
  if (file.type.startsWith("text/")) return file.text();
  if (!isPdf(file)) return "";

  // Load the parser only for PDFs. Some serverless runtimes cannot initialise
  // pdf-parse at module load time; doing so would make every file upload fail.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: await file.arrayBuffer() });
  try {
    const result = await parser.getText();
    return result.text.slice(0, 200_000);
  } finally {
    await parser.destroy();
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const form = await request.formData();
    const subjectId = form.get("subjectId");
    const file = form.get("file");
    if (typeof subjectId !== "string" || !(file instanceof File) || file.size === 0) return NextResponse.json({ error: "A subject and syllabus file are required." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Syllabus files must be smaller than 10 MB." }, { status: 400 });

    const { data: subject } = await supabase.from("subjects").select("id").eq("id", subjectId).eq("user_id", user.id).maybeSingle();
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

    let text = "";
    try {
      text = await extractSyllabusText(file);
    } catch {
      return NextResponse.json({ error: "This PDF could not be read. Upload a text-based PDF or add grade categories manually." }, { status: 422 });
    }

    const storagePath = `${user.id}/${subjectId}/${crypto.randomUUID()}-${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage.from("syllabi").upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 502 });

    const candidateWeights = text ? extractCandidateWeights(text) : [];
    const { data: syllabus, error } = await supabase.from("syllabi").insert({ user_id: user.id, subject_id: subjectId, storage_path: storagePath, extracted_text: text || null, candidate_weights: candidateWeights, validation_state: candidateWeights.length ? "needs_review" : "pending" }).select("id, candidate_weights, validation_state").single();
    if (error) {
      await supabase.storage.from("syllabi").remove([storagePath]).catch(() => undefined);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    await supabase.from("subjects").update({ syllabus_status: candidateWeights.length ? "needs_review" : "uploaded" }).eq("id", subjectId);
    return NextResponse.json(syllabus, { status: 201 });
  } catch (error) {
    console.error("Syllabus upload failed", error);
    return NextResponse.json({ error: "Could not upload the syllabus right now. Please try again." }, { status: 500 });
  }
}
