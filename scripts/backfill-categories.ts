// One-off backfill: re-runs the classifier against every job title and updates
// `category` + `programme` if they changed.
//
// Run with: pnpm dlx tsx scripts/backfill-categories.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env.local at the repo root.
//
// Operational notes:
//   - Both open AND closed jobs are reclassified by default so the historical
//     analytics surface is consistent after enum/classifier changes. Pass
//     --open-only if you only want to touch currently-open roles.
//   - Pagination is keyset (id-cursor) so the script is resumable and does
//     not hit the PostgREST 1000-row cap that the previous version silently
//     truncated against.
//   - Updates are bucketed by (category, programme) and batched via
//     .in('id', ...) so we make O(buckets) DB round-trips per page instead
//     of O(rows). A poller running concurrently can still race us, but the
//     window is small and the poller does not change category/programme on
//     conflict.
//   - Exits non-zero if any update fails so CI/scripts can detect partial
//     success instead of treating "Done." as victory.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { classify } from '../supabase/functions/_shared/classify';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const PAGE_SIZE = 500;
const UPDATE_BATCH = 100;
const OPEN_ONLY = process.argv.includes('--open-only');

function loadDotEnv(absPath: string) {
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch {
    return;
  }
  for (const rawLine of raw.split('\n')) {
    // Strip an optional `export ` prefix and trim trailing inline comments.
    const line = rawLine.replace(/^\s*export\s+/, '').replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    if (!k) continue;
    let v = line.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv(resolve(REPO_ROOT, '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

type JobSlice = { id: string; title: string; category: string; programme: string };

async function fetchPage(cursor: string | null): Promise<JobSlice[]> {
  let q = supabase
    .from('jobs')
    .select('id, title, category, programme')
    .order('id', { ascending: true })
    .limit(PAGE_SIZE);
  if (OPEN_ONLY) q = q.is('closed_at', null);
  if (cursor) q = q.gt('id', cursor);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as JobSlice[];
}

async function main() {
  let cursor: string | null = null;
  let totalSeen = 0;
  let totalQueued = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  // Bucket pending updates by (category, programme) so each DB call is one
  // UPDATE per bucket instead of one UPDATE per row.
  const buckets = new Map<string, { category: string; programme: string; ids: string[] }>();

  async function flush() {
    for (const b of buckets.values()) {
      if (b.ids.length === 0) continue;
      for (let i = 0; i < b.ids.length; i += UPDATE_BATCH) {
        const slice = b.ids.slice(i, i + UPDATE_BATCH);
        const { error } = await supabase
          .from('jobs')
          .update({ category: b.category, programme: b.programme })
          .in('id', slice);
        if (error) {
          console.error(`  batch update failed (${b.category}/${b.programme}, ${slice.length} ids):`, error.message);
          totalFailed += slice.length;
        } else {
          totalUpdated += slice.length;
        }
      }
    }
    buckets.clear();
  }

  for (;;) {
    const rows = await fetchPage(cursor);
    if (rows.length === 0) break;
    totalSeen += rows.length;
    cursor = rows[rows.length - 1].id;

    for (const job of rows) {
      const { category, programme } = classify(job.title);
      if (category === job.category && programme === job.programme) continue;
      totalQueued += 1;
      const k = `${category}::${programme}`;
      const b = buckets.get(k) ?? { category, programme, ids: [] };
      b.ids.push(job.id);
      buckets.set(k, b);
    }

    // Flush per fetched page so progress survives mid-run interruption.
    await flush();
    console.log(`  scanned ${totalSeen} | queued ${totalQueued} | updated ${totalUpdated}${totalFailed ? ` | failed ${totalFailed}` : ''}`);
  }

  console.log(`Done. scanned=${totalSeen} updated=${totalUpdated} failed=${totalFailed}`);
  if (totalFailed > 0) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
