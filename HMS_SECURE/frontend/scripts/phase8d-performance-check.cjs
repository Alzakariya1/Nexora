const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.jsx'), 'utf8');
const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
const checks = [
  ['Page modules are lazy-loaded', /lazy\(\(\) => import\("\.\/pages\//.test(main)],
  ['Suspense fallback is configured', /<Suspense fallback=/.test(main)],
  ['Main bundle no longer imports all pages from barrel', !/from "\.\/pages"/.test(main)],
  ['Vite manualChunks splits pages', /manualChunks/.test(vite) && /\/src\/pages\//.test(vite)],
  ['Chart vendor chunk exists in config', /vendor-charts/.test(vite)],
  ['Sourcemaps disabled for production build size', /sourcemap:\s*false/.test(vite)],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Frontend Phase 8D performance check failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`Frontend Phase 8D performance check passed (${checks.length}/${checks.length}).`);
