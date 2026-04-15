import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs'],
  target: 'node18',
  bundle: true,
  minify: false,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: [
    // Bundle the workspace package (not on npm, so must be inlined)
    '@ordomesh/drift-engine',
  ],
})
