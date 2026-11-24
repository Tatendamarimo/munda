// Writes shared/i18n/<lang>.json from the web dictionaries (web/src/i18n/*.ts), so the Android
// app shows exactly the same text. Run: npm run export:i18n  (a web test fails if it's stale).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = fileURLToPath(new URL('../../shared/i18n/', import.meta.url));
const server = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } });
try {
  const { exportI18n } = await server.ssrLoadModule('/src/i18n/export.ts');
  mkdirSync(out, { recursive: true });
  for (const [file, json] of Object.entries(exportI18n())) writeFileSync(out + file, json);
  console.log(`wrote ${Object.keys(exportI18n()).length} files to shared/i18n/`);
} finally {
  await server.close();
}
