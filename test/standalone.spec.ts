import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';

import markdown from 'markdown-it';
import caml_plugin from '../src';


// standalone: markdown-it-wikirefs is NOT co-registered. caml does NOT resolve wikirefs —
// a wiki-valued attribute renders as a plain string span showing the literal [[fname]].
// (caml + wikirefs interop, where wikirefs upgrades these to links, is covered elsewhere.)
describe('caml standalone (no wikirefs) wiki attr values', () => {

  it('renders a wiki attr value as a plain string span', () => {
    const md: MarkdownIt = markdown().use(caml_plugin, {});
    const actlHtml: string = md.render(':attrtype::[[fname-a]]\n');
    assert.ok(
      actlHtml.includes('<span class="attr wiki attrtype">[[fname-a]]</span>'),
      `expected a wiki string span, got:\n${actlHtml}`,
    );
    assert.ok(!/href=/.test(actlHtml), `expected no href, got:\n${actlHtml}`);
    assert.ok(!actlHtml.includes('data-wikiref'), `expected no hand-off attribute, got:\n${actlHtml}`);
  });

  it('ignores any resolvers passed to caml (caml never resolves wikirefs)', () => {
    const md: MarkdownIt = markdown().use(caml_plugin, {
      resolveHtmlHref: (_env: any, f: string) => '/tests/fixtures/' + f,
      resolveHtmlText: (_env: any, f: string) => f,
    } as any);
    const actlHtml: string = md.render(':attrtype::[[fname-a]]\n');
    assert.ok(
      actlHtml.includes('<span class="attr wiki attrtype">[[fname-a]]</span>'),
      `expected a wiki string span (resolvers ignored), got:\n${actlHtml}`,
    );
    assert.ok(!/href=/.test(actlHtml), 'no href even with resolvers');
  });

});
