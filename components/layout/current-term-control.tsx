'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TermOption, TermSwitcher } from './term-switcher';

interface CurrentTermControlProps { terms: TermOption[]; currentTermId: string; }

export function CurrentTermControl({ terms, currentTermId }: CurrentTermControlProps) {
  const [value, setValue] = useState(currentTermId);
  const [error, setError] = useState('');
  async function updateCurrentTerm(termId: string) {
    const previousValue = value;
    setValue(termId);
    setError('');
    const { error: updateError } = await createClient().from('profiles').update({ current_term_id: termId }).eq('id', (await createClient().auth.getUser()).data.user?.id ?? '');
    if (updateError) {
      setValue(previousValue);
      setError('Could not change the current academic term.');
    }
  }
  return <div className="min-w-60"><TermSwitcher terms={terms} value={value} onChange={updateCurrentTerm} />{error && <p className="mt-1 text-sm text-red-700" role="alert">{error}</p>}</div>;
}
