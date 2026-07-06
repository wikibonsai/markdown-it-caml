import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';

import type { CamlOptions } from '../src';

import markdown from 'markdown-it';
import caml_plugin from '../src';


// standalone: markdown-it-wikirefs is NOT co-registered. caml must still render a
// wiki-valued attribute as a valid <a> link, resolving via its OWN resolvers.
describe('caml standalone (no wikirefs) wiki attr values', () => {

  it('valid: renders wiki attr value as an <a> link via caml\'s own resolvers', () => {
    const camlOpts: Partial<CamlOptions> = {
      resolveHtmlHref: (_env: any, f: string) => '/tests/fixtures/' + f,
      resolveHtmlText: (_env: any, f: string) => f,
    };
    const md: MarkdownIt = markdown().use(caml_plugin, camlOpts);
    const actlHtml: string = md.render(':attrtype::[[fname-a]]\n');
    assert.ok(
      actlHtml.includes('<a class="attr wiki reftype__attrtype" href="/tests/fixtures/fname-a" data-href="/tests/fixtures/fname-a">fname-a</a>'),
      `expected a valid <a> link, got:\n${actlHtml}`,
    );
    // should NOT be a standalone span
    assert.ok(!actlHtml.includes('<span class="attr wiki'), `expected no wiki span, got:\n${actlHtml}`);
  });

  it('zombie: renders <a class="attr wiki invalid"> when href resolves undefined', () => {
    const camlOpts: Partial<CamlOptions> = {
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      resolveHtmlHref: (_env: any, _f: string) => undefined,
    };
    const md: MarkdownIt = markdown().use(caml_plugin, camlOpts);
    const actlHtml: string = md.render(':attrtype::[[fname-a]]\n');
    assert.ok(
      actlHtml.includes('<a class="attr wiki invalid">[[fname-a]]</a>'),
      `expected an invalid (zombie) <a>, got:\n${actlHtml}`,
    );
  });

  it('default fallback: no resolvers still yields a valid <a> (slugged href)', () => {
    const md: MarkdownIt = markdown().use(caml_plugin, {});
    const actlHtml: string = md.render(':attrtype::[[Fname A]]\n');
    assert.ok(
      actlHtml.includes('<a class="attr wiki reftype__attrtype" href="/fname-a" data-href="/fname-a">Fname A</a>'),
      `expected a default-resolved <a>, got:\n${actlHtml}`,
    );
  });

});
