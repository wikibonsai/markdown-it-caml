import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';
import type { RuleCore } from 'markdown-it/lib/parser_core';

import markdown from 'markdown-it';
import footnote from 'markdown-it-footnote';
import caml_plugin from '../src';
// the wikirefs sibling is a devDep for the co-registration (dual) test ONLY. gate on it:
// if it isn't installed (fresh CI without the companion), the dual suite SKIPS rather than
// crashing the file on a missing import.
/* eslint-disable @typescript-eslint/no-var-requires */
let wikirefs_plugin: any;
try { const m = require('markdown-it-wikirefs'); wikirefs_plugin = (m && m.default) || m; } catch { /* sibling not installed — dual suite skips */ }
/* eslint-enable @typescript-eslint/no-var-requires */
const hasWikirefsSibling: boolean = !!wikirefs_plugin;

import { camlCases } from 'caml-spec';
import type { WikiRefTestCase } from 'wikirefs-spec';
import { wikiAttrCases } from 'wikirefs-spec';

import { makeMockWikiRefsOpts } from './config';


// caml + wikirefs co-registered. caml owns the attrbox (wikirefs stands down — it does
// NOT add its 'wiki_attrbox' rule); caml emits string spans for wiki values and wikirefs
// upgrades them to resolved links. Runs the shared primitives (camlCases — identical
// output to caml-alone, so this doubles as a stand-down regression) + the resolved wiki
// cases (wikiAttrCases from wikirefs-spec).
interface RenderCase { mkdn: string; html: string; descr?: string; }

let env: any;
let md: MarkdownIt;

function run(contextMsg: string, tests: RenderCase[]): void {
  context(contextMsg, () => {
    let i: number = 0;
    for(const test of tests) {
      const desc: string = `[${('00' + (++i)).slice(-3)}] ` + (test.descr || '');
      it(desc, () => {
        const mkdn: string = test.mkdn;
        const expdHTML: string = test.html;
        const actlHTML: string = md.render(mkdn, env);
        assert.strictEqual(actlHTML, expdHTML);
      });
    }
  });
}

// dual suite runs only when the wikirefs sibling is installed (see hasWikirefsSibling)
(hasWikirefsSibling ? describe : describe.skip)('markdown-it-caml: caml + wikirefs', () => {

  before(() => {
    // the 2 gfm-footnote wikiattr fixtures ship as placeholders; supply the real
    // markdown-it-footnote html. caml stays OUT of the footnote (a nested context), so
    // wikirefs renders the value as a body wikilink inside. (Same before-hook structure
    // as the wikirefs-side render-w-caml — mutating the shared case objects, idempotently.)
    wikiAttrCases.forEach((testcase: WikiRefTestCase) => {
      if (testcase.descr === 'wikiattr; unprefixed; w/ other mkdn constructs; nested; gfm; footnote') {
        testcase.html =
            '<p><sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>\n'
          + '<hr class="footnotes-sep">\n'
          + '<section class="footnotes">\n'
          + '<ol class="footnotes-list">\n'
          + '<li id="fn1" class="footnote-item"><p>attrtype::<a class="wiki link" href="/tests/fixtures/fname-a" data-href="/tests/fixtures/fname-a">title a</a> <a href="#fnref1" class="footnote-backref">↩︎</a></p>\n'
          + '</li>\n'
          + '</ol>\n'
          + '</section>\n';
      }
      if (testcase.descr === 'wikiattr; prefixed; w/ other mkdn constructs; nested; gfm; footnote') {
        testcase.html =
            '<p><sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup></p>\n'
          + '<hr class="footnotes-sep">\n'
          + '<section class="footnotes">\n'
          + '<ol class="footnotes-list">\n'
          + '<li id="fn1" class="footnote-item"><p><a class="wiki link type reftype__attrtype" href="/tests/fixtures/fname-a" data-href="/tests/fixtures/fname-a">title a</a> <a href="#fnref1" class="footnote-backref">↩︎</a></p>\n'
          + '</li>\n'
          + '</ol>\n'
          + '</section>\n';
      }
    });
  });

  beforeEach(() => {
    // caml takes no resolvers; the co-registered wikirefs plugin does the resolving.
    // footnote plugin loaded so the gfm-footnote fixtures render (parity w/ markdown-it-wikirefs).
    // footnote cast to any: @types/markdown-it-footnote nests its own @types/markdown-it,
    // which conflicts with the top-level one — harmless type-only mismatch in tests.
    md = markdown().use(caml_plugin, {}).use(wikirefs_plugin, makeMockWikiRefsOpts()).use(footnote as any);
    env = { absPath: '/tests/fixtures/file-with-caml-attrs.md' };
  });

  it('wikirefs stands down: caml owns the attrbox, no \'wiki_attrbox\' rule added', () => {
    const coreRules: RuleCore[] = md.core.ruler.getRules('');
    const camlAttrsRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'attrbox');
    const wikiAttrsRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'wiki_attrbox');
    assert.strictEqual(camlAttrsRule.length, 1);
    assert.strictEqual(wikiAttrsRule.length, 0);
  });

  describe('render', () => {

    run('mkdn -> html; primitives (same output as caml alone)', camlCases as RenderCase[]);
    // blockquote "immediate after" (a caml attr on a lazy-continued line right after a
    // blockquote) is an unsolvable markdown-it limitation: the line is absorbed as blockquote
    // continuation, and caml's block rule sees parentType='blockquote' — which it MUST reject
    // (else "nested; not allowed inside" would wrongly make an attr), so it can't distinguish
    // "inside" from "immediately after". markdown-it-wikirefs hits the identical wall and
    // filters these same 2 (see render-wo-caml `failingTests`). Filtered here for parity (#4).
    run('mkdn -> html; wiki values resolved by wikirefs', (wikiAttrCases as RenderCase[]).filter((testcase: RenderCase) => {
      const failingTests: any = [
        'wikiattr; unprefixed; w/ other mkdn constructs; near blockquotes; immediate after',
        'wikiattr; prefixed; w/ other mkdn constructs; near blockquotes; immediate after',
      ];
      return !failingTests.some((descr: string) => descr === testcase.descr);
    }));

  });

});
