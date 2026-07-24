import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizedAst } from './ast-equal';
import { createRoundtripper, type Roundtripper } from './harness';

/**
 * THE round-trip gate (plan §3, D13). Every fixture must satisfy:
 *
 *   1. Idempotence — f(f(x)) === f(x): the first serialization may normalize
 *      style, but a second pass must be byte-identical (no drift, ever).
 *   2. AST-equivalence — parse(f(x)) ≡ parse(x) under the shared grammar:
 *      content is never lost, reordered, or mangled.
 *
 * This suite is a release ratchet: fixtures only get added (one per parser or
 * serializer bug found), never removed or weakened.
 */

const fixtures = import.meta.glob<string>('./fixtures/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const names = Object.keys(fixtures).sort();

describe('round-trip corpus (WYSIWYG parse ↔ serialize)', () => {
  let rt: Roundtripper;

  beforeAll(async () => {
    rt = await createRoundtripper();
  });
  afterAll(() => rt.destroy());

  it('has a meaningful corpus', () => {
    expect(names.length).toBeGreaterThanOrEqual(60);
  });

  for (const name of names) {
    const shortName = name.replace('./fixtures/', '').replace('.md', '');
    const input = fixtures[name];

    describe(shortName, () => {
      it('is idempotent: f(f(x)) === f(x)', () => {
        const once = rt.roundtrip(input);
        const twice = rt.roundtrip(once);
        expect(twice).toBe(once);
      });

      it('is AST-equivalent: parse(f(x)) ≡ parse(x)', () => {
        const once = rt.roundtrip(input);
        expect(normalizedAst(once)).toEqual(normalizedAst(input));
      });
    });
  }
});
