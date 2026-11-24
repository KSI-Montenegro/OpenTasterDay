// Meta Lead Ads: read the Taster Morning Facebook lead forms and their leads (Graph API).
import type { Lang } from './followup.ts';

const GRAPH = 'https://graph.facebook.com';

export type FbForm = { id: string; name: string; locale?: string; status?: string };
export type FbLead = {
  id: string;
  createdAt: number; // ms
  formId: string;
  lang: Lang;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type FieldData = { name?: string; values?: string[] }[];

const val = (fd: FieldData, ...names: string[]) => {
  for (const n of names) {
    const f = fd.find((x) => (x.name || '').toLowerCase() === n);
    const v = f?.values?.[0]?.trim();
    if (v) return v;
  }
  return '';
};

// Form language: "EN" / "English" in the name, or an English locale, means English; otherwise Montenegrin.
// FB_FORM_LANG (JSON {"<form id>": "en" | "mne"}) overrides.
export function formLang(form: FbForm, override?: string): Lang {
  try {
    const o = override ? (JSON.parse(override) as Record<string, string>) : {};
    if (o[form.id] === 'en' || o[form.id] === 'mne') return o[form.id] as Lang;
  } catch {}
  if (/\b(en|eng|english)\b/i.test(form.name) || /^en/i.test(form.locale || '')) return 'en';
  return 'mne';
}

// Which forms are Taster Morning forms: FB_FORM_IDS (comma list) if set, else name matches FB_FORM_MATCH.
export function isTasterForm(form: FbForm, ids?: string, match = 'taster|probno'): boolean {
  const list = (ids || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length) return list.includes(form.id);
  return new RegExp(match, 'i').test(form.name);
}

export function mapLead(raw: { id: string; created_time: string; field_data?: FieldData }, form: FbForm, lang: Lang): FbLead {
  const fd = raw.field_data || [];
  let first = val(fd, 'first_name');
  let last = val(fd, 'last_name');
  const full = val(fd, 'full_name', 'ime_i_prezime', 'name');
  if (!first && full) {
    // Greeting uses the first word; Facebook names often carry extra words ("Tanja Preočanin Ex Gaco").
    const parts = full.split(/\s+/);
    first = parts[0];
    last = parts.slice(1).join(' ');
  }
  return {
    id: raw.id,
    createdAt: Date.parse(raw.created_time) || Date.now(),
    formId: form.id,
    lang,
    firstName: first,
    lastName: last,
    email: val(fd, 'email', 'work_email').toLowerCase(),
    phone: val(fd, 'phone_number', 'phone', 'mobile_number')
  };
}

async function graph<T>(path: string, token: string, version: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}/${version}/${path}${sep}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(20000) });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || j.error) throw new Error(`Graph ${path.split('?')[0]}: ${res.status} ${j.error?.message || ''}`);
  return j;
}

// A system user token can read the Page's own token; with a Page token this returns it unchanged.
export async function pageToken(pageId: string, token: string, version: string): Promise<string> {
  try {
    const j = await graph<{ access_token?: string }>(`${pageId}?fields=access_token`, token, version);
    return j.access_token || token;
  } catch {
    return token;
  }
}

export async function tasterForms(pageId: string, token: string, version: string, env: Record<string, string | undefined>): Promise<FbForm[]> {
  // Known form ids: read just those (no need to list every form on the Page).
  const ids = (env.FB_FORM_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (ids.length) {
    const out: FbForm[] = [];
    for (const id of ids) {
      try {
        out.push(await graph<FbForm>(`${id}?fields=id,name,locale,status`, token, version));
      } catch {
        out.push({ id, name: id }); // name unknown (permissions): still read its leads
      }
    }
    return out;
  }
  const j = await graph<{ data: FbForm[] }>(`${pageId}/leadgen_forms?fields=id,name,locale,status&limit=200`, token, version);
  return (j.data || []).filter((f) => isTasterForm(f, env.FB_FORM_IDS, env.FB_FORM_MATCH || undefined));
}

export async function leadsSince(form: FbForm, sinceMs: number, token: string, version: string, langOverride?: string): Promise<FbLead[]> {
  const lang = formLang(form, langOverride);
  const filtering = encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(sinceMs / 1000) }]));
  const out: FbLead[] = [];
  let path: string | null = `${form.id}/leads?fields=id,created_time,field_data&limit=100&filtering=${filtering}`;
  for (let page = 0; path && page < 20; page++) {
    const j: { data?: { id: string; created_time: string; field_data?: FieldData }[]; paging?: { cursors?: { after?: string }; next?: string } } = await graph(path, token, version);
    for (const raw of j.data || []) out.push(mapLead(raw, form, lang));
    const after = j.paging?.next ? j.paging.cursors?.after : undefined;
    path = after ? `${form.id}/leads?fields=id,created_time,field_data&limit=100&filtering=${filtering}&after=${after}` : null;
  }
  return out;
}

// Meta's lead CSV export (Ads Manager / Leads Center): tab-separated, ids as "l:<id>", phones as "p:<phone>".
export function parseLeadsCsv(text: string, langOverride?: string): FbLead[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const cells = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  const head = cells(lines[0]);
  const col = (row: string[], name: string) => row[head.indexOf(name)] || '';
  return lines.slice(1).map((l) => {
    const row = cells(l);
    const form: FbForm = { id: col(row, 'form_id').replace(/^f:/, ''), name: col(row, 'form_name') };
    const fields = ['full_name', 'first_name', 'last_name', 'email', 'phone_number']
      .map((n) => ({ name: n, values: [col(row, n).replace(/^p:/, '')] }))
      .filter((f) => f.values[0]);
    return mapLead({ id: col(row, 'id').replace(/^l:/, ''), created_time: col(row, 'created_time'), field_data: fields }, form, formLang(form, langOverride));
  });
}
