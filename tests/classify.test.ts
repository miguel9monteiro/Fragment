// Classifier regression suite. Every entry in classify.fixture.json must
// round-trip through classify() to the same (category, programme) pair.
// The fixture is a snapshot of the live database's distinct classifications
// at the moment it was regenerated.
//
// When you intentionally change classifier rules, run:
//   pnpm classify:regen
// to refresh the fixture from the live DB. The diff in the resulting
// fixture commit is the change set you should review (a CR reviewer can
// scan the diff to confirm the intent matches the rule change).
//
// When a fixture entry flips unintentionally, the test fails with the
// specific title that drifted, plus the expected/actual pair. That's the
// regression we want to catch before merge.

import { describe, expect, test } from 'vitest';

import { classify } from '../supabase/functions/_shared/classify.ts';

import fixture from './classify.fixture.json' with { type: 'json' };

interface Entry {
  title: string;
  category: string;
  programme: string;
}

describe('classifier regression — full fixture round-trip', () => {
  // Vitest does not collect tests inside async iterators, so we declare the
  // loop synchronously here. With 230+ entries we get 230+ named cases in
  // the runner output, which makes a failure immediately scoped to the
  // exact title that drifted.
  for (const entry of fixture as Entry[]) {
    test(entry.title, () => {
      const result = classify(entry.title);
      expect(result).toEqual({
        category: entry.category,
        programme: entry.programme,
      });
    });
  }
});

describe('classifier — invariants', () => {
  test('classify() is pure (same input -> same output)', () => {
    const sample = 'Investment Banking Off Cycle Internship Programme London';
    const a = classify(sample);
    const b = classify(sample);
    expect(a).toEqual(b);
  });

  test('every fixture title is non-empty', () => {
    for (const entry of fixture as Entry[]) {
      expect(entry.title.length).toBeGreaterThan(0);
    }
  });

  test('every fixture entry has a recognised category', () => {
    const allowed = new Set([
      'investment_banking', 'sales_trading', 'research', 'asset_management',
      'wealth_management', 'private_equity', 'private_credit', 'hedge_fund',
      'quant', 'risk_compliance', 'technology', 'corporate_functions', 'other', 'risk',
    ]);
    for (const entry of fixture as Entry[]) {
      expect(allowed.has(entry.category)).toBe(true);
    }
  });

  test('every fixture entry has a recognised programme', () => {
    const allowed = new Set([
      'spring_week', 'summer_internship', 'off_cycle_internship', 'industrial_placement',
      'graduate', 'entry_level', 'mid_level', 'senior', 'experienced', 'unknown',
    ]);
    for (const entry of fixture as Entry[]) {
      expect(allowed.has(entry.programme)).toBe(true);
    }
  });
});
