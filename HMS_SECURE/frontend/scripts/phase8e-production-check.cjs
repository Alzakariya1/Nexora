const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..');
function read(file) { return fs.readFileSync(file, 'utf8'); }
function exists(file) { return fs.existsSync(file); }
const pkg = JSON.parse(read(path.join(root, 'package.json')));
const env = read(path.join(root, '.env.example'));
const vercel = read(path.join(root, 'vercel.json'));
const vite = read(path.join(root, 'vite.config.js'));
const checks = [
  ['Vercel config exists', exists(path.join(root, 'vercel.json'))],
  ['Vercel SPA fallback configured', /"destination"\s*:\s*"\/index\.html"/.test(vercel)],
  ['Frontend env uses API base URL', /VITE_API_URL=.*\/api/.test(env)],
  ['Production build script exists', Boolean(pkg.scripts.build)],
  ['Frontend testing script exists', Boolean(pkg.scripts['test:frontend'])],
  ['Frontend E2E script exists', Boolean(pkg.scripts['test:e2e'])],
  ['Frontend performance script exists', Boolean(pkg.scripts['test:performance'])],
  ['Phase 8E frontend script registered', Boolean(pkg.scripts['check:phase8e-production'])],
  ['Vite performance config preserved', /manualChunks/.test(vite) && /chunkSizeWarningLimit/.test(vite)],
  ['Production deployment docs exist', exists(path.join(repoRoot, 'docs', 'PRODUCTION_DEPLOYMENT_READINESS.md'))],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Frontend Phase 8E production readiness check failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`Frontend Phase 8E production readiness check passed (${checks.length}/${checks.length}).`);
