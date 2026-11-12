import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, normalize } from 'node:path';

// /data is the contract between scripts and site. Serve it in dev, copy it into the build.
function dataDir(): Plugin {
  const dir = resolve(__dirname, 'data');
  return {
    name: 'benfit-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res) => {
        const file = normalize(resolve(dir, '.' + decodeURIComponent((req.url ?? '').split('?')[0])));
        if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('content-type', 'application/json');
        res.end(readFileSync(file));
      });
    },
    writeBundle(opts) {
      cpSync(dir, resolve(opts.dir ?? 'dist', 'data'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [dataDir()],
  define: { 'process.env': {} },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
  test: { include: ['tests/**/*.test.ts'] },
});
