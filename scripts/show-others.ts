import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classify } from '../supabase/functions/_shared/classify';

const HERE = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(HERE, '.titles.json');

const rows: { id: string; title: string }[] = JSON.parse(readFileSync(INPUT, 'utf8'));
for (const r of rows) {
  const c = classify(r.title).category;
  if (c === 'other') console.log(r.title);
}
