const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const frontendRoot = path.join(root, 'frontend');
const mainPath = path.join(frontendRoot, 'src', 'main.jsx');
const viteConfigPath = path.join(frontendRoot, 'vite.config.js');
const packagePath = path.join(frontendRoot, 'package.json');
const main = fs.readFileSync(mainPath, 'utf8');
const vite = fs.readFileSync(viteConfigPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const checks = [
  ['React.lazy is used for page-level modules', /lazy\(\(\) => import\("\.\/pages\//.test(main)],
  ['Suspense fallback wraps lazy page rendering', /<Suspense fallback=/.test(main)],
  ['Direct eager ./pages barrel import removed from main bundle', !/from "\.\/pages"/.test(main)],
  ['Vite build config exists', fs.existsSync(viteConfigPath)],
  ['Vite manual chunking configured for pages', /manualChunks/.test(vite) && /\/src\/pages\//.test(vite)],
  ['Recharts separated for analytics-heavy screens', /vendor-charts/.test(vite)],
  ['Frontend performance check script registered', Boolean(pkg.scripts['check:phase8d-performance'])],
  ['Production build keeps chunk warning limit controlled', /chunkSizeWarningLimit/.test(vite)],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Phase 8D performance optimization check failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`Phase 8D performance optimization readiness check passed (${checks.length}/${checks.length}).`);
