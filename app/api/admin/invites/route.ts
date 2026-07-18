import { NextResponse } from 'next/server';
import { requireOwnerAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET() { await requireOwnerAdmin(); const supabase = await createClient(); const { data, error } = await supabase.from('invites').select('id, email, role, accepted_at, expires_at, created_at').order('created_at', { ascending: false }); return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json({ invites: data }); }

export async function POST(request: Request) { const owner = await requireOwnerAdmin(); const body = await request.json().catch(() => null) as { email?: string; role?: 'member' | 'owner_admin'; expiresAt?: string | null } | null; if (!body?.email || !/^\S+@\S+\.\S+$/.test(body.email)) return NextResponse.json({ error: 'A valid invite email is required.' }, { status: 400 }); const supabase = await createClient(); const { data, error } = await supabase.from('invites').insert({ email: body.email.trim().toLowerCase(), role: body.role ?? 'member', invited_by: owner.id, expires_at: body.expiresAt ?? null }).select('id, email, role').single(); return error ? NextResponse.json({ error: error.message }, { status: 502 }) : NextResponse.json({ invite: data }, { status: 201 }); }
