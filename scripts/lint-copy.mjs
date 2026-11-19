// Fails the build if any em dash (or en dash) slipped into the page copy or UI.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const roots = ['app', 'components', 'lib'];
let bad = 0;
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) return walk(p);
  if (!/\.(tsx?|css|mjs)$/.test(p)) return;
  readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    if (/[—–]/.test(line)) { console.error(`dash in ${p}:${i + 1}`); bad++; }
  });
});
roots.forEach(walk);
if (bad) process.exit(1);
console.log('Copy lint OK: no em or en dashes.');
