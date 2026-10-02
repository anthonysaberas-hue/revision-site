/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';

export default defineConfig({
  base: './',
  plugins: [
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkMath, remarkGfm], rehypePlugins: [rehypeSlug, rehypeKatex], providerImportSource: '@mdx-js/react' }) },
    react({ include: /\.(mdx|tsx|ts)$/ }),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
