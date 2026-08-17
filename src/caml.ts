import type MarkdownIt from 'markdown-it/lib';
import type Token from 'markdown-it/lib/token';
import type StateCore from 'markdown-it/lib/rules_core/state_core';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';

import type { CamlValData } from 'caml-mkdn';
import type { CamlOptions } from './types';

import * as CAML from 'caml-mkdn';


export const caml_attrs = (md: MarkdownIt, opts: CamlOptions): void => {

  // caml is wikirefs-agnostic by default: `[[x]]` resolves to a plain string. only when
  // markdown-it-wikirefs is co-registered (it installs the `wikiattr_val` render rule) do
  // we ask caml to recognize `[[x]]` as a 'wiki' type, which triggers the hand-off below.
  // checked at parse time so plugin registration order doesn't matter.
  const wikirefsPresent = (): boolean => !!md.renderer.rules.wikiattr_val;

  // ruler rules //

  // the 'caml' block rule is the parse that drives the markdown-it-caml plugin
  // should execute just before 'markdown-it-wikirefs': 
  // [ ..., 'hr', 'caml', 'wikiattr', 'list', ... ]
  // 
  // note: 'attrs' is added as an extra dummy 'alt' specifically for markdown-it-wikirefs interop
  // 'alt' lists the block rules this one may interrupt — parity with markdown-it-wikirefs'
  // wikiattr rule so a caml attr terminates a preceding paragraph/blockquote/list.
  md.block.ruler.after('hr', 'caml', caml_rule, { alt: ['paragraph', 'reference', 'blockquote', 'list', 'attrs'] });
  // the 'attrbox' rule is the midpoint between the parse and render rules.
  if (opts.attrs.render) {
    md.core.ruler.after('inline', 'attrbox', attrbox);
  }

  // render rules //

  md.renderer.rules.metadata_caml = metadata_caml;
  md.renderer.rules.attr_open     = attr_open;
  md.renderer.rules.attr_key      = attr_key;
  md.renderer.rules.attr_val      = attr_val;
  md.renderer.rules.attr_close    = attr_close;

  // ruler

  function caml_rule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    // init
    if (!state.env.attrs) { state.env.attrs = {}; }

    // from: https://github.com/markdown-it/markdown-it/blob/df4607f1d4d4be7fdc32e71c04109aea8cc373fa/lib/rules_block/list.js#L132
    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[startLine] - state.blkIndent >= 4) { return false; }

    // 'bMarks' = beginning of line markers
    // 'eMarks' = end of line markers
    let pos: number = state.bMarks[startLine];
    let max: number = state.eMarks[startLine];

    // 'attrs' must be at the top-most-level
    // !('list' | 'blockquote' | 'reference' | 'footnote')
    if ((state.parentType !== 'root') && (state.parentType !== 'paragraph')) {
      return false;
    }
    const chunk: string = state.src.substring(pos, max);
    // LINE.KEY uses restrictive value pattern (excludes brackets) to avoid
    // swallowing typed wikilinks like ':linktype::[[target]].'
    // Fallback: if LINE.KEY fails, try permissive match for wiki values,
    // but reject if there's content after ']]' (typed wikilink indicator)
    let lineOneMatch: RegExpExecArray | null = CAML.RGX.LINE.KEY.exec(chunk);
    if (lineOneMatch === null) {
      const permissive: RegExp = new RegExp(
        '^' + CAML.RGX.MARKER.KEY_PRFX.source + '?'
        + '(' + CAML.RGX.VALID_CHARS.KEY.source + ')'
        + CAML.RGX.MARKER.COL.source
        + '(' + CAML.RGX.VALID_CHARS.VAL.source + ')?'
        + '$', 'im'
      );
      lineOneMatch = permissive.exec(chunk);
      if (lineOneMatch === null) {
        return false;
      }
      // reject typed wikilinks / trailing text: ']]' followed (after optional
      // whitespace) by a non-comma, non-']' char — e.g. '[[target]].' or
      // '[[target]] text'. A comma AFTER the whitespace is a list separator, so
      // padded lists like '[[a]] , [[b]]' are allowed (the splitter below trims).
      // Matches caml-mkdn's load, which accepts the pad but not trailing text.
      const val: string | undefined = lineOneMatch[2];
      if (val && /\]\]\s*[^\s,\]]/.test(val)) {
        return false;
      }
      // labelled wikilinks are typed wikilinks, not attrs: a wikiattr value is a
      // bare reference ('[[target]]'), so a label ('[[target|label]]') means
      // display-text prose — caml stands down and lets wikirefs render it as a
      // typed wikilink (e.g. ':linktype::[[fname|label]]'). (A bare '[[target]]'
      // stays a wikiattr; a malformed '[fname]' stays a caml string primitive —
      // only the non-bare wiki forms fall back.)
      if (val && /\[\[[^\]]*\|[^\]]*\]\]/.test(val)) {
        return false;
      }
      // header wikilinks ('[[target#header]]') are section links, not bare wikiattr
      // refs — like labelled wikilinks, caml stands down and lets wikirefs render the
      // (typed) wikilink. wikirefs-spec marks these 'headers not supported in wikiattrs'.
      if (val && /\[\[[^\]]*#[^\]]*\]\]/.test(val)) {
        return false;
      }
    }
    // is in a list item
    // note: this is only necessary for unprefixed wikiattrs
    // todo: keep an eye on this...might cause problems...
    if ((lineOneMatch[0].indexOf('- ') === 0)
    || (lineOneMatch[0].indexOf('* ') === 0)
    || (lineOneMatch[0].indexOf('+ ') === 0)
    ) {
      return false;
    }
    // strictness: only ONE optional space is allowed after '::' (parity with wikirefs).
    // COL consumes up to one space, so if the captured value still has LEADING
    // whitespace, there were >1 spaces after '::' — reject (not a wikiattr).
    if (lineOneMatch[2] && /^\s/.test(lineOneMatch[2])) {
      return false;
    }

    // "Don't run any pairs in validation mode":
    // 'silent' is used when this rule is being checked against 
    // in another rule to see whether or not the other rule should 
    // kick out for this (or some other) one. return 'true' to 
    // signify that the kick out should happen.
    if (silent) {
      return true;
    }

    /*
     * handle match and return true
     */
    let iterLine: number = 0;
    let m: RegExpExecArray | null;
    const curAttrItems: string[] = [];

    const key: string = lineOneMatch[1].trim();
    const value: string = lineOneMatch[2];

    // helper: collect multi-line block continuation lines and build CamlValData
    function collectMultiLineBlock(indicator: string, prefix: string): CamlValData {
      const blockLines: string[] = [];
      // collect continuation lines: indented or empty
      while ((startLine + iterLine) < endLine) {
        const contPos: number = state.bMarks[startLine + iterLine];
        const contMax: number = state.eMarks[startLine + iterLine];
        const contLine: string = state.src.substring(contPos, contMax);
        // empty line: part of the block only if more indented content follows.
        // if the next non-blank line is non-indented (a following attr/paragraph),
        // this blank is a separator that ends the block (for non-keep modes) — it
        // must not be swallowed. matches caml-mkdn's stop rule; keep mode (+)
        // still preserves trailing blanks.
        if (contLine.trim() === '') {
          const isKeepMode: boolean = indicator.endsWith('+');
          let foundNext: boolean = false;
          let nextIndented: boolean = false;
          for (let k = (startLine + iterLine + 1); k < endLine; k++) {
            const lookahead: string = state.src.substring(state.bMarks[k], state.eMarks[k]);
            if (lookahead.trim() === '') { continue; }
            foundNext = true;
            nextIndented = /^\s/.test(lookahead);
            break;
          }
          // a blank followed by a non-indented line (a following attr/paragraph)
          // ends the block and is a separator, not block content — so exclude it.
          // at EOF (no following content) or when more indented content follows,
          // keep it (chomp handles trailing-newline semantics downstream).
          if (foundNext && !nextIndented && !isKeepMode) { break; }
          blockLines.push(contLine);
          iterLine += 1;
          continue;
        }
        // indented line is part of block
        if (/^\s/.test(contLine)) {
          blockLines.push(contLine);
          iterLine += 1;
          continue;
        }
        // non-empty, non-indented line ends the block
        break;
      }
      const blockContent: string = blockLines.join('\n');
      // for keep mode (+), include trailing blank lines in the raw block
      const hasTrailingBlank: boolean = (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '');
      const isKeepMode: boolean = indicator.endsWith('+');
      const rawBlock: string = prefix + indicator + '\n' + blockContent + (isKeepMode && hasTrailingBlank ? '\n' : '');
      // use CAML.load on the full attr line to get the correctly processed value
      // include trailing newline if block ended with an empty line to preserve
      // trailing newline semantics for folded/literal mode
      const trailingNewline: boolean = !isKeepMode && (blockLines.length > 0 && blockLines[blockLines.length - 1] === '');
      const fullAttrLine: string = ':' + key + '::' + rawBlock + (trailingNewline ? '\n' : '');
      const loadResult: any = CAML.load(fullAttrLine, { wikirefs: wikirefsPresent() });
      const processedValue: string = (loadResult && loadResult.data && loadResult.data[key] !== undefined)
        ? String(loadResult.data[key])
        : '';
      return {
        type: 'string',
        string: rawBlock,
        value: processedValue,
      };
    }

    const MULTILINE_RGX: RegExp = new RegExp('^' + CAML.RGX.MARKER.MLINE_STR.source + '$');

    // values
    //   - multi-line string (folded >, literal |, chomped >-, >|)
    if ((value !== '') && (value !== null) && (value !== undefined) && MULTILINE_RGX.test(value.trim())) {
      iterLine += 1;
      const typedItem: CamlValData = collectMultiLineBlock(value.trim(), ' ');
      curAttrItems.push(typedItem as any);
    //   - single/comma-separated list
    } else if ((value !== '') && (value !== null) && (value !== undefined)) {
      iterLine += 1;
      let curVal: string = '';
      let inDoubleQuote: boolean = false;
      let inSingleQuote: boolean = false;
      for (const char of value) {
        // comma separation
        if ((!inDoubleQuote && !inSingleQuote) && (char === ',')) {
          curAttrItems.push(curVal.trim());
          curVal = '';
          continue;
        }
        // quote
        if (/"/.test(char)) {
          inDoubleQuote = !inDoubleQuote;
        }
        if (/'/.test(char)) {
          inSingleQuote = !inSingleQuote;
        }
        // char
        curVal += char;
      }
      // last value: multi-line indicators not supported in comma lists
      // (treated as literal string values)
      curAttrItems.push(curVal.trim());
    //   - mkdn-separated list
    } else {
      // loop through each markdown-style list item
      // do-while: https://stackoverflow.com/a/6323598
      do {
        // increment
        iterLine += 1;
        if ((startLine + iterLine) >= endLine) { m = null; break; }
        pos = state.bMarks[startLine + iterLine];
        max = state.eMarks[startLine + iterLine];
        const thisChunk: string = state.src.substring(pos, max);
        m = CAML.RGX.LINE.LIST_ITEM.exec(thisChunk);
        if (m !== null) {
          // m[0]: full match;
          // m[1]: bullet type;
          // m[2]: filename / value
          const listItemVal: string = m[2];
          if (MULTILINE_RGX.test(listItemVal.trim())) {
            // next line starts continuation block
            iterLine += 1;
            const typedItem: CamlValData = collectMultiLineBlock(listItemVal.trim(), '');
            curAttrItems.push(typedItem as any);
          } else {
            curAttrItems.push(listItemVal);
          }
        }
      } while (m);
    }

    // set 'state.env.attrs' to trigger tokens -- if valid.
    if (curAttrItems.length === 0) {
      return false;
    } else {
      // init
      if (!state.env.attrs[key]) { state.env.attrs[key] = []; }
      // prep renderables
      const resolvedItems: CamlValData[] = [];
      for (const attrItem of curAttrItems) {
        // multi-line items are already resolved
        if (typeof attrItem === 'object' && attrItem !== null && 'type' in attrItem) {
          resolvedItems.push(attrItem);
        } else {
          const typedItem: CamlValData = CAML.resolve(attrItem, { wikirefs: wikirefsPresent() });
          resolvedItems.push(typedItem);
        }
      }
      for (const item of resolvedItems) {
        state.env.attrs[key].push(item);
      }
      // metadata
      if (opts.addAttr) {
        const tok: Token = new state.Token('metadata_caml', '', 0);
        state.tokens.push(tok);
        tok.attrSet('key', key);
        tok.attrSet('vals', state.env.attrs[key].map((item: any) => item.string));
      }
      state.line += iterLine;
      return true;
    }
  }

  function attrbox(state: StateCore): void {
    if (!state.env.attrs
    || (JSON.stringify(state.env.attrs) === '{}')
    || (Object.keys(state.env.attrs).length === 0)
    ) {
      return;
    }
    const tokens: Token[] = [];

    // open //

    const tokOpen: Token = new state.Token('attr_open', '', 0);
    // tokOpen.map = [startLine, iterLine];
    tokens.push(tokOpen);

    // body //

    for (const key in state.env.attrs) {
      // key / linktype
      const tokType: Token = new state.Token('attr_key', '', 0);
      tokType.attrSet('key', key);
      tokens.push(tokType);
      // values / items
      for (const item of state.env.attrs[key]) {
        let tokItem: Token;
        // if markdown-it-wikirefs is installed and item is wiki type,
        // use wikiattr_val token so wikirefs can render it
        if (item.type === 'wiki' && md.renderer.rules.wikiattr_val) {
          tokItem = new state.Token('wikiattr_val', '', 1);
          const filename: string | undefined = item.value;
          if (!filename) { continue; }
          tokItem.attrSet('key', key);
          tokItem.attrSet('val', filename);
        } else {
          tokItem = new state.Token('attr_val', '', 1);
          tokItem.attrSet('key', key);
          tokItem.attrSet('type', item.type);
          // for multi-line strings, use 'value' (the processed/joined text)
          // for all other items, use 'string' (the raw display text)
          if (item.type === 'string' && item.string && item.string.includes('\n')) {
            tokItem.attrSet('val', String(item.value));
          } else {
            tokItem.attrSet('val', item.string);
          }
        }
        tokens.push(tokItem);
      }
    }

    // close //

    const tokClose: Token = new state.Token('attr_close', '', 0);
    tokens.push(tokClose);

    // add infobox tokens to **front** of token stream (should occur after flush)
    if (tokens) { state.tokens = tokens.concat(state.tokens); }
  }

  // "render"

  function metadata_caml(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    const token: Token = tokens[index];
    const attrtype: string | null = token.attrGet('key');
    // @ts-expect-error: forcing array -- technically not supposed to, but it works so nicely here (see note above)
    const filenames: string[] | null = token.attrGet('vals');
    if (attrtype && filenames && opts.addAttr) {
      for (const filename of filenames) {
        opts.addAttr(env, attrtype, filename);
      }
    }
    return '';
  }

  // render

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_open(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    return `<aside class="${opts.cssNames.attrbox}">\n<dl>\n`;
  }

  // attr : key : attrtype
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_key(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    const token: Token = tokens[index];
    const key: string | null = token.attrGet('key');
    // Check if there's a previous attr_key (meaning we need to close the previous group div)
    let hasPriorKey = false;
    for (let i = index - 1; i >= 0; i--) {
      if (tokens[i].type === 'attr_key') { hasPriorKey = true; break; }
      if (tokens[i].type === 'attr_open') { break; }
    }
    const prefix: string = hasPriorKey ? `</div>\n<div class="${opts.cssNames.attrItem}">\n` : `<div class="${opts.cssNames.attrItem}">\n`;
    if (key === null) {
      return `${prefix}<dt>attr key error</dt>\n`;
    } else {
      // the key's class rides the dt (key__<slug> -- the composer owns the
      // contract); value spans carry structure + type only. See caml-spec.
      return `${prefix}<dt class="${CAML.keyCssClass(key)}">${key}</dt>\n`;
    }
  }

  // attr : val(s) : item(s)
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_val(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    const token: Token = tokens[index];
    // invalid
    if (token === null) {
      return '<dd>attr error</dd>\n';// primitives
    } else {
      const valType: string | null = token.attrGet('type');
      const strValue: string | null = token.attrGet('val');
      // caml does NOT resolve wikirefs. A wiki value renders as a plain string — a span
      // with the 'string' type class showing the literal [[fname]] — like any string
      // value. When markdown-it-wikirefs is co-registered, wiki values are emitted as
      // 'wikiattr_val' tokens (see attrbox) and resolved by wikirefs, so this renderer
      // only ever sees the standalone case. See caml-wikiref-handoff.
      // convert newlines to <br> for proper HTML rendering of multi-line values
      // classes via the composer: structure + value type, NO raw key (the key's
      // class lives on the dt); the structural token stays overridable
      const typeCls: string = CAML.attrCssClasses(valType as string)[1];
      const displayValue: string = strValue ? strValue.replace(/\n/g, '<br>') : '';
      const rendered: string = `<span class="${opts.cssNames.attr} ${typeCls}">${displayValue}</span>`;
      return `<dd>${rendered}</dd>\n`;
    }
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_close(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    delete env.cur_attr_key;
    return '</div>\n</dl>\n</aside>\n';
  }
};
