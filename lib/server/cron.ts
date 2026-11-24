import crypto from 'node:crypto';

// Vercel Cron calls with "Authorization: Bearer <CRON_SECRET>". Without a secret set, nothing runs.
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') || '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Test-only clock override (FOLLOWUP_NOW=2026-11-27T10:00:00+01:00), never set in normal use.
export const nowMs = () => Date.parse(process.env.FOLLOWUP_NOW || '') || Date.now();
