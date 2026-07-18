import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type RequestBody = { provider?: 'openai' | 'hackclub'; apiKey?: string; model?: string; prompt?: string; };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body?.provider || !body.apiKey || !body.prompt) return NextResponse.json({ error: 'Provider, unlocked API key, and prompt are required.' }, { status: 400 });
  const endpoint = body.provider === 'hackclub' ? (process.env.HACK_CLUB_AI_BASE_URL ?? 'https://ai.hackclub.com/v1') : 'https://api.openai.com/v1';
  const response = await fetch(`${endpoint}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${body.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: body.model ?? (body.provider === 'hackclub' ? 'qwen3-32b' : 'gpt-4o-mini'), temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'Return JSON only: {"summary": string, "proposals": [{"action":"create_task"|"update_task", "title": string, "dueAt": string|null, "priority":"low"|"normal"|"high"}]}. Never claim that any action was applied.' }, { role: 'user', content: body.prompt }] }) });
  if (!response.ok) return NextResponse.json({ error: `AI provider request failed (${response.status}).` }, { status: 502 });
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const proposal = JSON.parse(result.choices?.[0]?.message?.content ?? '{}') as Record<string, unknown>;
  const { data: conversation, error } = await supabase.from('ai_conversations').insert({ user_id: user.id, provider: body.provider, messages: [{ role: 'user', content: body.prompt }], proposal }).select('id, proposal').single();
  return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json(conversation);
}
