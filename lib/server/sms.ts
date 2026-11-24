// SMS: Brevo first, Infobip as the fallback (for example when Brevo has no SMS credits).

export type SmsResult = { ok: boolean; provider: 'brevo' | 'infobip' | 'none'; status: number; detail?: string };

export async function sendSms(to: string, text: string, env: Record<string, string | undefined>): Promise<SmsResult> {
  const digits = to.replace(/[^\d]/g, '');
  let last: SmsResult = { ok: false, provider: 'none', status: 0, detail: 'no SMS provider configured' };
  if (env.BREVO_API_KEY && env.BREVO_SMS_SENDER) {
    try {
      const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: env.BREVO_SMS_SENDER, recipient: digits, content: text, type: 'transactional', tag: 'taster-fb-followup' }),
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) return { ok: true, provider: 'brevo', status: res.status };
      last = { ok: false, provider: 'brevo', status: res.status, detail: (await res.text()).slice(0, 300) };
    } catch (e) {
      last = { ok: false, provider: 'brevo', status: 0, detail: String(e) };
    }
  }
  if (env.INFOBIP_API_KEY && env.INFOBIP_BASE_URL) {
    try {
      const base = env.INFOBIP_BASE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const res = await fetch(`https://${base}/sms/2/text/advanced`, {
        method: 'POST',
        headers: { authorization: `App ${env.INFOBIP_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ messages: [{ destinations: [{ to: digits }], from: env.INFOBIP_SENDER || 'KSI', text }] }),
        signal: AbortSignal.timeout(15000)
      });
      const body = (await res.text()).slice(0, 300);
      // Infobip answers 200 with a per-message status; REJECTED_* groups mean it was not sent.
      if (res.ok && !/"groupName"\s*:\s*"REJECTED/.test(body)) return { ok: true, provider: 'infobip', status: res.status, detail: body };
      last = { ok: false, provider: 'infobip', status: res.status, detail: body };
    } catch (e) {
      last = { ok: false, provider: 'infobip', status: 0, detail: String(e) };
    }
  }
  return last;
}
