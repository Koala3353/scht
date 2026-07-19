import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { ProviderResync } from '../../components/integrations/provider-resync';

afterEach(() => {
  cleanup();
  refresh.mockClear();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ProviderResync', () => {
  it('refreshes Google once on first mount and lets the user repeat that request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      calendar: { state: 'synced', imported: 2, message: '2 Calendar events imported.' },
      gmail: { state: 'synced', imported: 1, message: '1 Gmail task imported.' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ProviderResync providers={['google']} />);

    await screen.findByText('2 Calendar events imported.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/integrations/google/sync', { method: 'POST' });
    expect(refresh).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Resync Google Calendar and Gmail' }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('sends the Canvas sync action independently alongside Google and remains retryable after degradation', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('canvas')) return jsonResponse({ error: 'Canvas is temporarily unavailable.' }, false);
      return jsonResponse({
        calendar: { state: 'synced', imported: 0, message: '0 Calendar events imported.' },
        gmail: { state: 'degraded', imported: 0, message: 'Gmail is temporarily rate-limited.' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ProviderResync providers={['google', 'canvas']} />);

    await screen.findByText('Canvas is temporarily unavailable.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/integrations/canvas', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'sync' }),
    }));
    expect(screen.getByText('Gmail is temporarily rate-limited.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Resync Google Calendar and Gmail and Canvas' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not make provider requests without a saved connection', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await act(async () => {
      render(<ProviderResync providers={[]} />);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Resync providers' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
