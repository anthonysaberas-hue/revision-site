/**
 * Rehype plugin: turns remark-math's hast output into <MathTex tex="..." /> JSX nodes so KaTeX
 * runs in the browser instead of inlining its (huge) HTML into every compiled MDX page.
 * scripts/check-mdx.mjs still uses rehype-katex so TeX errors are caught at check time.
 */
type Node = {
  type: string;
  tagName?: string;
  properties?: { className?: string[] | string };
  value?: string;
  children?: Node[];
  name?: string;
  attributes?: unknown[];
};

const classes = (n: Node): string[] => {
  const c = n.properties?.className;
  return Array.isArray(c) ? c : typeof c === 'string' ? c.split(/\s+/) : [];
};
const text = (n: Node): string => (n.type === 'text' ? n.value ?? '' : (n.children ?? []).map(text).join(''));
const isMath = (n: Node | undefined, kind: string) => n?.type === 'element' && n.tagName === 'code' && classes(n).includes(kind);

function jsx(tex: string, display: boolean): Node {
  const attributes: unknown[] = [{ type: 'mdxJsxAttribute', name: 'tex', value: tex }];
  if (display) attributes.push({ type: 'mdxJsxAttribute', name: 'display', value: null });
  return { type: display ? 'mdxJsxFlowElement' : 'mdxJsxTextElement', name: 'MathTex', attributes, children: [] };
}

type Pos = { start?: { offset?: number }; end?: { offset?: number } };
type Src = { value?: unknown };

/** remark-math parses one-line `$$…$$` as inline math; detect it from the source text and promote to display. */
function walk(node: Node, src: string) {
  const kids = node.children;
  if (!kids) return;
  const isDollar2 = (k: Node) => {
    const pos = (k as Node & { position?: Pos }).position;
    const a = pos?.start?.offset, b = pos?.end?.offset;
    return a != null && b != null && src.slice(a, b).startsWith('$$');
  };
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.type === 'element' && k.tagName === 'pre' && k.children?.length === 1 && isMath(k.children[0], 'math-display')) {
      kids[i] = jsx(text(k.children[0]), true);
    } else if (isMath(k, 'math-inline')) {
      kids[i] = jsx(text(k), isDollar2(k));
    } else if (isMath(k, 'math-display')) {
      kids[i] = jsx(text(k), true);
    } else {
      walk(k, src);
      if (k.type === 'element' && k.tagName === 'p') {
        const real = (k.children ?? []).filter((c) => !(c.type === 'text' && !(c.value ?? '').trim()));
        if (real.length === 1 && real[0].type === 'mdxJsxFlowElement') kids[i] = real[0];
      }
    }
  }
}

export function rehypeMathToJsx() {
  return (tree: Node, file?: Src) => walk(tree, String(file?.value ?? ''));
}
