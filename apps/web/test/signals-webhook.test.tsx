import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignalsPage } from '../src/features/live/SignalsPage';
import { createMemoryResearchRepo } from '../src/storage/strategy-repo';

function page(o: Partial<Parameters<typeof SignalsPage>[0]> = {}) {
  const props = {
    research: createMemoryResearchRepo(),
    displayTz: 'UTC' as const,
    now: () => Date.parse('2026-10-15T09:00:00Z'),
    webhookUrl: null,
    onWebhookUrl: vi.fn(),
    notify: null,
    onTest: vi.fn().mockResolvedValue(undefined),
    ...o,
  };
  render(<SignalsPage {...props} />);
  return { props, box: within(screen.getByRole('region', { name: 'Bildirim (webhook)' })) };
}

describe('Signals page webhook settings (D76)', () => {
  it('saves only an http(s) address', () => {
    const { props, box } = page();
    expect(box.getByText('Kapalı: bildirim gönderilmiyor.')).toBeTruthy();
    const input = box.getByLabelText('Webhook adresi');
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    expect(box.getByText(/Yalnızca http/)).toBeTruthy();
    expect((box.getByRole('button', { name: 'Kaydet' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'http://localhost:5678/webhook/trw' } });
    fireEvent.click(box.getByRole('button', { name: 'Kaydet' }));
    expect(props.onWebhookUrl).toHaveBeenCalledWith('http://localhost:5678/webhook/trw');
  });

  it('can be turned off and tested, and shows the last delivery result', () => {
    const { props, box } = page({
      webhookUrl: 'http://localhost:5678/webhook/trw',
      notify: { at: Date.parse('2026-10-15T08:30:00Z'), sent: 1, failed: 1, error: 'HTTP 404' },
    });
    expect(box.getByText('Açık: http://localhost:5678/webhook/trw')).toBeTruthy();
    expect(box.getByText(/1 gönderildi, 1 başarısız/)).toBeTruthy();
    expect(box.getByText('Son hata: HTTP 404')).toBeTruthy();
    fireEvent.click(box.getByRole('button', { name: 'Test bildirimi gönder' }));
    expect(props.onTest).toHaveBeenCalled();
    fireEvent.click(box.getByRole('button', { name: 'Kapat' }));
    expect(props.onWebhookUrl).toHaveBeenCalledWith(null);
  });

  it('offers no test without an address', () => {
    const { box } = page();
    expect(box.queryByRole('button', { name: 'Test bildirimi gönder' })).toBeNull();
  });
});
