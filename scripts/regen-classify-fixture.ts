// Regenerates tests/classify.fixture.json from the live database. Run this
// whenever you intentionally tune the classifier rules — the resulting
// diff is the change set a reviewer scans to confirm the rule change had
// the intended effect.
//
// Pulls one row per distinct title (rows that share a title were always
// classified identically because classify() is pure), sorted alphabetically
// so the fixture is byte-stable across runs.
//
// Usage:
//   pnpm classify:regen
//
// Requires:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY        (read access to jobs table)
// Both in .env.local — the same vars the admin client uses.

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

// Load .env.local if present. We don't bring in dotenv as a runtime dep
// (it's pulled transitively by other devDeps); if not installed, fail
// gracefully.
try {
  // The dotenv package is small and already present transitively (Next
  // bundles it). If the resolver can't find it, env vars must come from
  // the shell.
  loadEnv({ path: resolve(process.cwd(), '.env.local') });
} catch {
  // ignore — assume env is exported manually
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set both in .env.local.',
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Row {
  title: string;
  category: string;
  programme: string;
}

async function main() {
  // PostgREST doesn't expose `select distinct on`, so we fetch the full set
  // and dedupe client-side. ~5k rows max even when the DB grows — trivial.
  const { data, error } = await supabase
    .from('jobs')
    .select('title,category,programme')
    .not('title', 'is', null)
    .limit(10_000);
  if (error) {
    console.error(`query failed: ${error.message}`);
    process.exit(1);
  }
  const seen = new Map<string, Row>();
  for (const r of (data ?? []) as Row[]) {
    if (!r.title || !r.title.trim()) continue;
    if (!seen.has(r.title)) seen.set(r.title, r);
  }
  const rows = Array.from(seen.values()).sort((a, b) => a.title.localeCompare(b.title));

  const out = JSON.stringify(rows, null, 2) + '\n';
  const path = resolve(process.cwd(), 'tests/classify.fixture.json');
  writeFileSync(path, out);
  console.log(`wrote ${rows.length} entries to ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
