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

function walk(node: Node) {
  const kids = node.children;
  if (!kids) return;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.type === 'element' && k.tagName === 'pre' && k.children?.length === 1 && isMath(k.children[0], 'math-display')) {
      kids[i] = jsx(text(k.children[0]), true);
    } else if (isMath(k, 'math-inline')) {
      kids[i] = jsx(text(k), false);
    } else if (isMath(k, 'math-display')) {
      kids[i] = jsx(text(k), true);
    } else {
      walk(k);
    }
  }
}

export function rehypeMathToJsx() {
  return (tree: Node) => walk(tree);
}
