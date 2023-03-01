// note:
// other tests use esm 'import' style imports.
// this test verifies 'require' style imports works too.

import assert from 'node:assert/strict';
import type MarkdownIt from 'markdown-it';
import markdown from 'markdown-it';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const caml_plugin = require('../../dist/index.cjs.js');

// setup

let md: MarkdownIt;

describe('import', () => {

  beforeEach(() => {
    md = markdown().use(caml_plugin);
  });

  it('require style', () => {
    assert.strictEqual(
      md.render(':attrtype::string-value'),
      // eslint-disable-next-line
`<aside class="attrbox">
<span class="attrbox-title">Attributes</span>
<dl>
<dt>attrtype</dt>
<dd><span class="attr string attrtype">string-value</span></dd>
</dl>
</aside>
`
    );
  });

});
