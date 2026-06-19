import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';
import type { RuleCore } from 'markdown-it/lib/parser_core';

import type { CamlOptions } from '../../src';
import type { WikiRefsOptions } from 'markdown-it-wikirefs';

import markdown from 'markdown-it';
import caml_plugin from '../../src';
import wikirefs_plugin from 'markdown-it-wikirefs';


describe('caml + wikirefs compatibility', () => {

  it('both installed; do not add \'wiki_attrbox\' rule', () => {
    // setup
    const wikiOpts: Partial<WikiRefsOptions> = {
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      resolveHtmlHref: (env: any, fname: string) => { return undefined; },
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      resolveHtmlText: (env: any, fname: string) => { return undefined; },
    };
    const camlOpts: Partial<CamlOptions> = {};
    const md: MarkdownIt = markdown();
    md.use(caml_plugin, camlOpts);
    md.use(wikirefs_plugin, wikiOpts);
    // parser rules
    const coreRules: RuleCore[] = md.core.ruler.getRules('');
    const camlAttrsCoreRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'attrbox');
    const wikiAttrsCoreRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'wiki_attrbox');
    // assert
    assert.strictEqual(camlAttrsCoreRule.length, 1);
    assert.strictEqual(wikiAttrsCoreRule.length, 0);

    // render
    /* eslint-disable indent */
    const actlHtml: string = md.render(
`attr1::[[wikiattr1]]
:attr2::[[wikiattr2]]
:attr3::[[wikiattr3]], [[wikiattr4]]
:attr4::
- [[wikiattr5]]
- [[wikiattr6]]
attr5::string1
:attr6::string2
:attr7::string3, string4
:attr8::
- string5
- string6
`
    );
    // assert
    // note: invalid wikiattrs only proves the wikiattrs code path is executed...this is enough for now.
    assert.strictEqual(actlHtml,
      '<aside class="attrbox">\n'
    + '<dl>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr1</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr1]]</a></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr2</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr2]]</a></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr3</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr3]]</a></dd>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr4]]</a></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr4</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr5]]</a></dd>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr6]]</a></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr5</dt>\n'
    + '<dd><span class="attr string attr5">string1</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr6</dt>\n'
    + '<dd><span class="attr string attr6">string2</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr7</dt>\n'
    + '<dd><span class="attr string attr7">string3</span></dd>\n'
    + '<dd><span class="attr string attr7">string4</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr8</dt>\n'
    + '<dd><span class="attr string attr8">string5</span></dd>\n'
    + '<dd><span class="attr string attr8">string6</span></dd>\n'
    + '</div>\n'
    + '</dl>\n'
    + '</aside>\n'
    );
  });

  it('only \'wikirefs\' installed; add \'wiki_attrbox\' rule', () => {
    // setup
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const wikiOpts: Partial<WikiRefsOptions> = {
      resolveHtmlHref: (env: any, fname: string) => { return undefined; },
      resolveHtmlText: (env: any, fname: string) => { return undefined; },
    };
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const md: MarkdownIt = markdown();
    md.use(wikirefs_plugin, wikiOpts);
    // parser rules
    const coreRules: RuleCore[] = md.core.ruler.getRules('');
    const camlAttrsCoreRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'attrbox');
    const wikiAttrsCoreRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'wiki_attrbox');
    // assert
    assert.strictEqual(camlAttrsCoreRule.length, 0);
    assert.strictEqual(wikiAttrsCoreRule.length, 1);

    // render
    /* eslint-disable indent */
    const actlHtml: string = md.render(
`attr1::[[wikiattr1]]
:attr2::[[wikiattr2]]
:attr3::[[wikiattr3]], [[wikiattr4]]
:attr4::
- [[wikiattr5]]
- [[wikiattr6]]
attr5::string1
:attr6::string2
:attr7::string3, string4
:attr8::
- string5
- string6
`
    );
    // assert
    // note: invalid wikiattrs only proves the wikiattrs code path is executed...this is enough for now.
    assert.strictEqual(actlHtml,
      '<aside class="attrbox">\n'
    + '<dl>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr1</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr1]]</a></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr2</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr2]]</a></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr3</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr3]]</a></dd>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr4]]</a></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr4</dt>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr5]]</a></dd>\n'
    + '<dd><a class="attr wiki invalid">[[wikiattr6]]</a></dd>\n'
    + '</div>\n'
    + '</dl>\n'
    + '</aside>\n'
    + '<p>attr5::string1\n:attr6::string2\n:attr7::string3, string4</p>\n'
    + '<p>:attr8::</p>\n'
    + '<ul>\n'
    + '<li>string5</li>\n'
    + '<li>string6</li>\n'
    + '</ul>\n'
    );
    /* eslint-enable indent */
  });

  it('only \'caml\' installed; add \'wiki_attrbox\' rule', () => {
    // setup
    const camlOpts: Partial<CamlOptions> = {};
    const md: MarkdownIt = markdown();
    md.use(caml_plugin, camlOpts);
    // parser rules
    const coreRules: RuleCore[] = md.core.ruler.getRules('');
    const camlAttrsCoreRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'attrbox');
    const wikiAttrsCoreRule: RuleCore[] = coreRules.filter((rule: any) => rule.name === 'wiki_attrbox');
    // assert
    assert.strictEqual(camlAttrsCoreRule.length, 1);
    assert.strictEqual(wikiAttrsCoreRule.length, 0);

    // render
    /* eslint-disable indent */
    const actlHtml: string = md.render(
`attr1::[[wikiattr1]]
:attr2::[[wikiattr2]]
:attr3::[[wikiattr3]], [[wikiattr4]]
:attr4::
- [[wikiattr5]]
- [[wikiattr6]]
attr5::string1
:attr6::string2
:attr7::string3, string4
:attr8::
- string5
- string6
`
    );
    // assert
    assert.strictEqual(actlHtml,
      '<aside class="attrbox">\n'
    + '<dl>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr1</dt>\n'
    + '<dd><span class="attr wiki attr1">[[wikiattr1]]</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr2</dt>\n'
    + '<dd><span class="attr wiki attr2">[[wikiattr2]]</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr3</dt>\n'
    + '<dd><span class="attr wiki attr3">[[wikiattr3]]</span></dd>\n'
    + '<dd><span class="attr wiki attr3">[[wikiattr4]]</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr4</dt>\n'
    + '<dd><span class="attr wiki attr4">[[wikiattr5]]</span></dd>\n'
    + '<dd><span class="attr wiki attr4">[[wikiattr6]]</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr5</dt>\n'
    + '<dd><span class="attr string attr5">string1</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr6</dt>\n'
    + '<dd><span class="attr string attr6">string2</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr7</dt>\n'
    + '<dd><span class="attr string attr7">string3</span></dd>\n'
    + '<dd><span class="attr string attr7">string4</span></dd>\n'
    + '</div>\n'
    + '<div class="attr-item">\n'
    + '<dt>attr8</dt>\n'
    + '<dd><span class="attr string attr8">string5</span></dd>\n'
    + '<dd><span class="attr string attr8">string6</span></dd>\n'
    + '</div>\n'
    + '</dl>\n'
    + '</aside>\n'
    );
    /* eslint-enable indent */
  });

});
