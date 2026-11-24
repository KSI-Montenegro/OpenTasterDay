// Text messages to Facebook leads: WhatsApp first (Infobip, with automatic SMS failover when the
// number is not on WhatsApp or the message is not delivered); otherwise SMS (Brevo, then Infobip).

export type SmsResult = { ok: boolean; provider: 'whatsapp' | 'brevo' | 'infobip' | 'none'; status: number; detail?: string };

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

const infobipBase = (env: Record<string, string | undefined>) => (env.INFOBIP_BASE_URL || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

// WhatsApp needs a Meta-approved template; INFOBIP_WA_TEMPLATES maps "<step><lang>" to its name,
// e.g. {"1mne":"taster_followup_1_mne"}. The template has one body placeholder: the link.
export function waTemplate(env: Record<string, string | undefined>, key: string): string {
  try {
    return String((JSON.parse(env.INFOBIP_WA_TEMPLATES || '{}') as Record<string, string>)[key] || '');
  } catch {
    return '';
  }
}

export function whatsappRequest(env: Record<string, string | undefined>, to: string, template: string, language: string, link: string, smsText: string) {
  return {
    messages: [
      {
        channel: 'WHATSAPP',
        sender: env.INFOBIP_WHATSAPP_SENDER,
        destinations: [{ to: to.replace(/[^\d]/g, '') }],
        content: { templateName: template, templateData: { body: { placeholders: [link] } }, language },
        failover: [{ channel: 'SMS', sender: env.INFOBIP_SENDER || 'KSI', content: { body: { text: smsText, type: 'TEXT' } } }]
      }
    ]
  };
}

// WhatsApp first if configured for this step and language, else SMS.
export async function sendText(
  to: string,
  msg: { key: string; lang: 'en' | 'mne'; link: string; smsText: string },
  env: Record<string, string | undefined>
): Promise<SmsResult> {
  const template = waTemplate(env, msg.key);
  if (env.INFOBIP_WHATSAPP_SENDER && template && env.INFOBIP_API_KEY && infobipBase(env)) {
    try {
      const res = await fetch(`https://${infobipBase(env)}/messages-api/1/messages`, {
        method: 'POST',
        headers: { authorization: `App ${env.INFOBIP_API_KEY}`, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(whatsappRequest(env, to, template, msg.lang === 'mne' ? 'sr' : 'en', msg.link, msg.smsText)),
        signal: AbortSignal.timeout(15000)
      });
      const body = (await res.text()).slice(0, 300);
      if (res.ok && !/"groupName"\s*:\s*"REJECTED/.test(body)) return { ok: true, provider: 'whatsapp', status: res.status, detail: body };
    } catch {}
  }
  return sendSms(to, msg.smsText, env);
}
