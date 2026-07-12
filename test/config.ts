import { makeMockOptsForRenderOnly as sharedMockOpts } from 'wikirefs-spec';

// Render-only resolvers for the co-registered wikirefs plugin (dual-plugin tests).
// The shared helper in wikirefs-spec is (filename)-only; markdown-it resolvers are
// env-first, so adapt to the (env, filename) signature. caml itself takes NO resolvers
// (it never resolves wikirefs) — these are for the wikirefs plugin only.
//
// The return type is a loose LOCAL shape, deliberately NOT markdown-it-wikirefs's
// WikiRefsOptions: the wikirefs sibling is an optional dual-test devDep, so caml's
// tests must COMPILE even when it isn't installed (the dual then skips via the gate in
// render-w-wiki.spec.ts). A static `import type` from the sibling would break compilation
// of the whole suite in that case — see the gating there.
interface WikiRefsRenderOpts {
  resolveHtmlText?: (env: any, filename: string) => (string | undefined);
  resolveHtmlHref?: (env: any, filename: string) => (string | undefined);
}

export function makeMockWikiRefsOpts(): WikiRefsRenderOpts {
  const shared = sharedMockOpts();
  return {
    resolveHtmlText: (_env: any, filename: string): (string | undefined) => shared.resolveHtmlText(filename),
    resolveHtmlHref: (_env: any, filename: string): (string | undefined) => shared.resolveHtmlHref(filename),
  };
}
