// Vitest config. The classifier under test lives in a Deno-shaped file
// (supabase/functions/_shared/classify.ts) with no Node-specific imports;
// Vite/Vitest's ESM resolver handles the .ts extension directly so the
// only setup we need is pointing at the tests directory.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The Edge-Function tree imports Deno globals (Deno.serve) at module load;
    // we only test pure-function classify.ts which is at the bottom of that
    // tree. Excluding the rest of supabase/functions/ keeps Vitest from
    // accidentally collecting tests against the runner code.
    exclude: ['supabase/functions/**', 'node_modules/**', '.next/**'],
  },
});
