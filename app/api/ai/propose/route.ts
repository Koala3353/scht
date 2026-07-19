import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  provider: z.enum(["openai", "hackclub"]),
  apiKey: z.string().trim().min(8).max(512),
  model: z.string().trim().min(1).max(100).optional(),
  prompt: z.string().trim().min(1).max(6000),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Choose a provider, enter a valid unlocked key, and keep your planning request under 6,000 characters.",
      },
      { status: 400 },
    );
  const body = parsed.data;
  const endpoint =
    body.provider === "hackclub"
      ? (process.env.HACK_CLUB_AI_BASE_URL ?? "https://ai.hackclub.com/v1")
      : "https://api.openai.com/v1";
  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${body.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model:
          body.model ??
          (body.provider === "hackclub" ? "qwen3-32b" : "gpt-4o-mini"),
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Return JSON only: {"summary": string, "proposals": [{"action":"create_task", "title": string, "dueAt": string|null, "priority":"low"|"normal"|"high"}]}. Return only tasks to create; never describe an update. Never claim that any action was applied.',
          },
          { role: "user", content: body.prompt },
        ],
      }),
    });
    if (!response.ok)
      return NextResponse.json(
        { error: `AI provider request failed (${response.status}).` },
        { status: 502 },
      );
    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    let proposal: Record<string, unknown>;
    try {
      proposal = JSON.parse(
        result.choices?.[0]?.message?.content ?? "{}",
      ) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          error:
            "The AI provider returned an unreadable proposal. Please try again.",
        },
        { status: 502 },
      );
    }
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: user.id,
        provider: body.provider,
        messages: [{ role: "user", content: body.prompt }],
        proposal,
      })
      .select("id, proposal")
      .single();
    return error
      ? NextResponse.json({ error: error.message }, { status: 502 })
      : NextResponse.json(conversation);
  } catch {
    return NextResponse.json(
      {
        error:
          "The AI provider could not be reached. Check your connection and try again.",
      },
      { status: 502 },
    );
  }
}
