// Aligns supabase_migrations.schema_migrations.version values with the
// numeric prefix on the local migration files in supabase/migrations/.
//
// Background: applying migrations via the Supabase MCP records them with a
// timestamp version (e.g. "20260517155126") regardless of the local
// filename prefix (e.g. "0020"). The Supabase CLI's `db push` then sees
// the local 0020 as "not yet applied" and tries to re-run it. The fix is
// to rewrite the ledger row's version field to match the local prefix.
//
// This script reads every local migration filename, matches each remote
// ledger row by `name` (the part after the version prefix), and renames
// the version to the local prefix. Idempotent and safe to re-run.
//
// Usage:
//   pnpm migrations:align
//
// Requires:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';

try {
  loadEnv({ path: resolve(process.cwd(), '.env.local') });
} catch {
  // ignore
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  // Target the supabase_migrations schema. This is set per-call below; the
  // default schema for everything else is public.
});

interface Migration {
  version: string;
  name: string | null;
}

async function main() {
  // 1. Discover local migrations from disk. Expected filename pattern:
  //    NNNN_descriptive_name.sql  (e.g. "0020_daily_digests_table.sql").
  const migrationsDir = resolve(process.cwd(), 'supabase/migrations');
  const localFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  const localByName = new Map<string, string>(); // name -> version
  for (const f of localFiles) {
    const m = f.match(/^(\d+)_(.+)\.sql$/);
    if (!m) continue;
    const [, version, name] = m;
    localByName.set(name, version);
  }
  console.log(`found ${localByName.size} local migrations`);

  // 2. Pull every row from the remote ledger. The supabase_migrations
  //    schema is not in the public PostgREST surface by default, so we
  //    talk to it through the schema() chain available on the client.
  const { data, error } = await supabase
    .schema('supabase_migrations' as never)
    .from('schema_migrations')
    .select('version,name')
    .order('version');
  if (error) {
    console.error(`load ledger failed: ${error.message}`);
    process.exit(1);
  }
  const remote = (data ?? []) as Migration[];
  console.log(`found ${remote.length} remote ledger entries`);

  // 3. For each remote row, if its name matches a local file AND the
  //    version differs from the local prefix, rewrite. We intentionally do
  //    NOT touch rows whose name has no local match — those are migrations
  //    applied outside this checkout (e.g. Studio quick-fixes).
  let renamed = 0;
  let skipped = 0;
  for (const row of remote) {
    if (!row.name) {
      skipped += 1;
      continue;
    }
    const targetVersion = localByName.get(row.name);
    if (!targetVersion) {
      skipped += 1;
      continue;
    }
    if (row.version === targetVersion) continue;
    const { error: updErr } = await supabase
      .schema('supabase_migrations' as never)
      .from('schema_migrations')
      .update({ version: targetVersion })
      .eq('version', row.version);
    if (updErr) {
      // Most likely cause: targetVersion collides with another row already
      // at that version (e.g. someone hand-applied 0020 via the CLI). Log
      // and continue; the operator can resolve manually.
      console.error(`failed to rename ${row.version} -> ${targetVersion} (${row.name}): ${updErr.message}`);
      continue;
    }
    console.log(`renamed ${row.version} -> ${targetVersion} (${row.name})`);
    renamed += 1;
  }
  console.log(`done: ${renamed} renamed, ${skipped} skipped (no local match)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
