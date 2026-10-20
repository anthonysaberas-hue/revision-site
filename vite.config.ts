/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

export default defineConfig({
  base: './',
  build: { reportCompressedSize: false, sourcemap: false },
  plugins: [
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkMath, remarkGfm], rehypePlugins: [rehypeSlug], providerImportSource: '@mdx-js/react' }) },
    react({ include: /\.(mdx|tsx|ts)$/ }),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
