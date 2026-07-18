'use client';

import { FormEvent, useState } from 'react';
import { encryptVault, decryptVault, type EncryptedVault } from '@/lib/ai/vault';
import { createClient } from '@/lib/supabase/client';

function toBytea(bytes: Uint8Array) { return `\\x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`; }
function fromBytea(value: string) { const encoded = value.startsWith('\\x') ? value.slice(2) : value; return Uint8Array.from(encoded.match(/.{1,2}/g) ?? [], (chunk) => Number.parseInt(chunk, 16)); }
const sessionVaultKey = 'scht-unlocked-ai-keys';

export function AiVaultPanel() {
  const [provider, setProvider] = useState<'openai' | 'hackclub'>('openai'); const [apiKey, setApiKey] = useState(''); const [passphrase, setPassphrase] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in again before saving your vault.');
      const { data: existing, error: existingError } = await supabase.from('encrypted_ai_vaults').select('ciphertext, salt, iv').eq('user_id', user.id).maybeSingle(); if (existingError) throw existingError;
      const savedValues = existing ? await decryptVault(passphrase, { ciphertext: fromBytea(existing.ciphertext), salt: fromBytea(existing.salt), iv: fromBytea(existing.iv) } satisfies EncryptedVault) : {};
      const values = { ...savedValues, [provider]: apiKey };
      const encrypted = await encryptVault(passphrase, values);
      sessionStorage.setItem(sessionVaultKey, JSON.stringify(values));
      const { error } = await supabase.from('encrypted_ai_vaults').upsert({ user_id: user.id, ciphertext: toBytea(encrypted.ciphertext), salt: toBytea(encrypted.salt), iv: toBytea(encrypted.iv) }, { onConflict: 'user_id' });
      if (error) throw error; setApiKey(''); setPassphrase(''); setNotice('Your API key is encrypted in your personal vault and unlocked for this browser tab.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save the encrypted vault.'); }
    setBusy(false);
  }
  async function verify() {
    setBusy(true); setNotice('');
    try {
      const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in again before unlocking your vault.');
      const { data, error } = await supabase.from('encrypted_ai_vaults').select('ciphertext, salt, iv').eq('user_id', user.id).maybeSingle(); if (error) throw error; if (!data) throw new Error('No encrypted AI vault has been saved yet.');
      const values = await decryptVault(passphrase, { ciphertext: fromBytea(data.ciphertext), salt: fromBytea(data.salt), iv: fromBytea(data.iv) } satisfies EncryptedVault);
      sessionStorage.setItem(sessionVaultKey, JSON.stringify(values)); setNotice(`Vault unlocked for this browser tab. Saved providers: ${Object.keys(values).join(', ')}.`); setPassphrase('');
    } catch { setNotice('The passphrase did not unlock this vault.'); }
    setBusy(false);
  }
  return <section className="mt-5 max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold">Encrypted AI key vault</h2><p className="mt-1 text-sm text-slate-600">Your provider key is encrypted in the browser with your passphrase before it reaches Supabase. Scht cannot recover a forgotten passphrase.</p><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={save}><label className="text-sm font-semibold">Provider<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" onChange={(event) => setProvider(event.target.value as 'openai' | 'hackclub')} value={provider}><option value="openai">OpenAI</option><option value="hackclub">Hack Club AI</option></select></label><label className="text-sm font-semibold">Provider API key<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" onChange={(event) => setApiKey(event.target.value)} required type="password" value={apiKey} /></label><label className="text-sm font-semibold">Vault passphrase<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" minLength={12} onChange={(event) => setPassphrase(event.target.value)} required type="password" value={passphrase} /></label><div className="flex flex-wrap items-end gap-3"><button className="rounded-xl bg-action px-4 py-2 font-bold text-white disabled:opacity-60" disabled={busy} type="submit">Encrypt and save key</button><button className="rounded-xl border border-teal px-4 py-2 font-bold text-teal disabled:opacity-60" disabled={busy || !passphrase} onClick={() => void verify()} type="button">Verify passphrase</button></div></form>{notice && <p className="mt-3 text-sm text-slate-700" role="status">{notice}</p>}</section>;
}
