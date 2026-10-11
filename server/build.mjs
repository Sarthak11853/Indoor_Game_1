// Bundles the server (and the shared package it imports) into dist/index.js.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  alias: { '@hv/shared': '../shared/src/index.ts' },
  // The built server is always production: dev tools stay off unless HV_DEV=1.
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
