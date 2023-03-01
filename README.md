# markdown-it-caml

![[A WikiBonsai Project](https://github.com/wikibonsai/wikibonsai)](https://img.shields.io/badge/%F0%9F%8E%8B-A%20WikiBonsai%20Project-brightgreen)
[![NPM package](https://img.shields.io/npm/v/markdown-it-caml)](https://npmjs.org/package/markdown-it-caml)

A markdown-it plugin to process [caml](https://github.com/wikibonsai/caml) -- Colon Attribute Markup Language.

Note that this plugin only parses the input -- it is up to you to handle and store metadata.

🕸 Weave a semantic web in your [🎋 WikiBonsai](https://github.com/wikibonsai/wikibonsai) digital garden.

## Install

Install with [npm](https://docs.npmjs.com/cli/v9/commands/npm-install):

```
npm install markdown-it-caml
```

## Use

```js
import markdownIt from 'markdown-it';
import caml_plugin from 'markdown-it-caml';

const md = markdownIt();
let opts = {};
md.use(caml_plugin, opts);

md.render(':caml::attribute\n');
```

Require style imports work as well:

```js
const caml_plugin = require('markdown-it-caml');

// if you encounter issues, try:
const caml_plugin = require('markdown-it-caml').default;
```

## Syntax

For syntax specifications, see the [caml](https://github.com/wikibonsai/caml/tree/main/spec) repo.

## Options

### `attrs`

These are options wikiattrs-specific options.

#### `attrs.enable`

A boolean property that toggles parsing and rendering wikiattrs on/off.

#### `attrs.render`

A boolean property that toggles rendering wikiattrs on/off. This is useful in the scenario where wikiattrs are used for metadata and not for display purposes; like a yaml-stand-in.

#### `attrs.title`

A string to be rendered in the wikiattrs' attrbox.

### `cssNames`

CSS classnames may be overridden here.

#### `cssNames.attr`

Classname for wikiattrs. Default is `attr`.

#### `cssNames.attrbox`

Classname for the wikiattr attrbox. Default is `attrbox`.

#### `cssNames.attrboxTitle`

Classname for the wikiattr attrbox title. Default is `attrbox-title`.
