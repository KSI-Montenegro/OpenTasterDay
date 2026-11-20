// Re-send every Tally booking (EN and MNE forms) to the shared applicant sheet.
// Safe to re-run: the sheet skips Response IDs it already has.
//
//   TALLY_API_KEY=... SHEET_WEBHOOK_URL=... SHEET_WEBHOOK_TOKEN=... npm run sync-sheet
import { parseSubmission } from '../lib/server/tally.ts';
import { appendToSheet } from '../lib/server/sheet.ts';

const FORMS = ['5X9P2d', 'db0ePA'];
// The Tally API names questions by their field name; give them labels the parser knows.
const LABELS: Record<string, string> = {
  parent_name: 'Parent name', child_name: 'Child name', current_school: 'Current school',
  current_grade: 'Current grade', english_level: 'English level', mother_tongue: 'Mother tongue', medical: 'Medical'
};

const key = process.env.TALLY_API_KEY || '';
const url = process.env.SHEET_WEBHOOK_URL || '';
const token = process.env.SHEET_WEBHOOK_TOKEN || '';
if (!key || !url || !token) throw new Error('Set TALLY_API_KEY, SHEET_WEBHOOK_URL and SHEET_WEBHOOK_TOKEN');

type Q = { id: string; type: string; title: string; fields?: { uuid: string; title: string }[] };
type R = { questionId: string; answer: unknown };
type S = { id: string; submittedAt: string; isCompleted: boolean; responses: R[] };

for (const form of FORMS) {
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.tally.so/forms/${form}/submissions?filter=completed&page=${page}`, {
      headers: { authorization: `Bearer ${key}` }
    });
    if (!res.ok) throw new Error(`Tally ${form} page ${page}: ${res.status}`);
    const d = (await res.json()) as { hasMore: boolean; questions: Q[]; submissions: S[] };
    const qs = new Map(d.questions.map((q) => [q.id, q]));
    for (const sub of d.submissions) {
      const fields = sub.responses.flatMap((r) => {
        const q = qs.get(r.questionId);
        if (!q) return [];
        if (q.type === 'HIDDEN_FIELDS' && r.answer && typeof r.answer === 'object') {
          return Object.entries(r.answer as Record<string, unknown>).map(([label, value]) => ({ label, type: 'HIDDEN_FIELDS', value }));
        }
        const type = q.type === 'DROPDOWN' ? 'DROPDOWN' : q.type;
        return [{ label: LABELS[q.title] || q.title, type, value: r.answer }];
      });
      const s = parseSubmission({ data: { responseId: sub.id, createdAt: sub.submittedAt, fields } });
      if (!s) continue;
      const out = await appendToSheet(url, token, s);
      console.log(form, sub.id, out.ok ? out.detail : `FAILED ${out.status} ${out.detail}`);
    }
    if (!d.hasMore) break;
  }
}
