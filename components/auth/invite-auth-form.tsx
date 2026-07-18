'use client';

import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Message = { kind: 'error' | 'success'; text: string } | null;
const callbackUrl = () => `${window.location.origin}/auth/callback`;

export function InviteAuthForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<Message>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setIsSubmitting(true);
    setMessage(null);
    const supabase = createClient();
    const { data: hasInvite, error: inviteError } = await supabase.rpc('has_available_invite', { candidate_email: normalizedEmail });
    if (inviteError || !hasInvite) {
      setMessage({ kind: 'error', text: 'This email does not have an available Scht invite.' });
      setIsSubmitting(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { emailRedirectTo: callbackUrl() } });
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'Check your email for your secure sign-in link.' });
    setIsSubmitting(false);
  }

  async function signInWithGoogle() {
    setIsSubmitting(true);
    setMessage(null);
    const { data, error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } });
    if (error || !data.url) {
      setMessage({ kind: 'error', text: error?.message ?? 'Google sign-in could not start.' });
      setIsSubmitting(false);
      return;
    }
    window.location.assign(data.url);
  }

  return <div className="mt-7 space-y-4">
    <form className="space-y-3" onSubmit={submitMagicLink}>
      <label className="block text-sm font-semibold text-ink" htmlFor="invite-email">School email</label>
      <input className="w-full rounded-xl border border-slate-300 bg-white px-4" id="invite-email" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.edu" required type="email" value={email} />
      <button className="w-full rounded-xl bg-teal px-5 font-bold text-white disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? 'Sending…' : 'Email me a sign-in link'}</button>
    </form>
    <button className="w-full rounded-xl border border-slate-300 bg-white px-5 font-bold text-ink disabled:opacity-60" disabled={isSubmitting} onClick={signInWithGoogle} type="button">Continue with Google</button>
    {message && <p aria-live="polite" className={message.kind === 'error' ? 'text-sm text-red-700' : 'text-sm text-teal'}>{message.text}</p>}
  </div>;
}
