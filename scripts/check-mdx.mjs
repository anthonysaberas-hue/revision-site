// Usage: node scripts/check-mdx.mjs <file.mdx> [more.mdx ...]
// Compiles each MDX page exactly like the site does, reports syntax errors, KaTeX errors,
// and any <Component> that is not exported by core/ui or the sims/ and figures/ folders of the course
// the file lives in (src/courses/<course>/...).
import { compile } from '@mdx-js/mdx';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function collect(file, known) {
  const s = fs.readFileSync(file, 'utf8');
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g)) known.add(m[1]);
  for (const m of s.matchAll(/export\s*\{([^}]+)\}/g)) m[1].split(',').forEach((x) => x.trim() && known.add(x.trim().split(/\s+as\s+/).pop()));
}
const coreUi = path.join(root, 'src/core/ui.tsx');
const byCourse = new Map(); // course folder -> Set of known components
function knownFor(file) {
  const rel = path.relative(path.join(root, 'src/courses'), file).split(path.sep);
  const course = rel.length > 1 && !rel[0].startsWith('..') ? rel[0] : 'mech430';
  if (!byCourse.has(course)) {
    const set = new Set();
    const into = (f) => collect(f, set);
    into(coreUi);
    for (const dir of ['sims', 'figures']) {
      const d = path.join(root, 'src/courses', course, dir);
      if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/\.tsx?$/.test(f)) into(path.join(d, f));
    }
    byCourse.set(course, set);
  }
  return byCourse.get(course);
}

let bad = 0;
for (const arg of process.argv.slice(2)) {
  const file = path.resolve(arg);
  const src = fs.readFileSync(file, 'utf8');
  const known = knownFor(file);
  const problems = [];
  try {
    const out = String(await compile(src, { remarkPlugins: [remarkMath, remarkGfm], rehypePlugins: [rehypeSlug, [rehypeKatex, { throwOnError: false, strict: 'ignore' }]] }));
    for (const m of out.matchAll(/katex-error[^>]*title=\\?"([^"\\]+)/g)) problems.push(`KaTeX: ${m[1]}`);
    if (/katex-error/.test(out) && !problems.length) problems.push('KaTeX error somewhere (search the page for red math)');
  } catch (e) {
    problems.push(`MDX: ${e.message}${e.line ? ` (line ${e.line}:${e.column})` : ''}`);
  }
  const noCode = src.replace(/```[\s\S]*?```/g, '').replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$\n]*\$/g, '');
  for (const m of noCode.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) if (!known.has(m[1])) problems.push(`Unknown component <${m[1]}> (export it from your sims/figures file)`);
  if (problems.length) {
    bad++;
    console.log(`✗ ${path.relative(root, file)}`);
    for (const p of [...new Set(problems)]) console.log(`   - ${p}`);
  } else console.log(`✓ ${path.relative(root, file)}`);
}
process.exit(bad ? 1 : 0);
