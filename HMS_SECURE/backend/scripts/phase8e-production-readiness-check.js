const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const backendRoot = path.join(root, 'backend');
const frontendRoot = path.join(root, 'frontend');
const docsRoot = path.join(root, 'docs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function exists(file) {
  return fs.existsSync(file);
}

const backendPkg = JSON.parse(read(path.join(backendRoot, 'package.json')));
const frontendPkg = JSON.parse(read(path.join(frontendRoot, 'package.json')));
const backendEnv = read(path.join(backendRoot, '.env.example'));
const frontendEnv = read(path.join(frontendRoot, '.env.example'));
const renderYaml = read(path.join(backendRoot, 'render.yaml'));
const vercelJson = read(path.join(frontendRoot, 'vercel.json'));
const deploymentDoc = read(path.join(docsRoot, 'PRODUCTION_DEPLOYMENT_READINESS.md'));
const releaseRunbook = read(path.join(docsRoot, 'runbooks', 'PRODUCTION_RELEASE_RUNBOOK.md'));
const ciWorkflow = read(path.join(root, '.github', 'workflows', 'ci.yml'));

const checks = [
  ['Production deployment readiness doc exists', exists(path.join(docsRoot, 'PRODUCTION_DEPLOYMENT_READINESS.md'))],
  ['Release notes exist', exists(path.join(docsRoot, 'RELEASE_NOTES.md'))],
  ['Production release runbook exists', exists(path.join(docsRoot, 'runbooks', 'PRODUCTION_RELEASE_RUNBOOK.md'))],
  ['Environment matrix exists', exists(path.join(docsRoot, 'ENVIRONMENT_MATRIX.md'))],
  ['CI workflow exists', exists(path.join(root, '.github', 'workflows', 'ci.yml'))],
  ['Render uses backend root directory', /rootDir:\s*backend/.test(renderYaml)],
  ['Render uses npm ci for reproducible installs', /buildCommand:\s*npm ci/.test(renderYaml)],
  ['Render health check path documented', /\/api\/health\/ready/.test(deploymentDoc) && /\/api\/health\/ready/.test(releaseRunbook)],
  ['Frontend Vercel SPA rewrite preserved', /"destination"\s*:\s*"\/index\.html"/.test(vercelJson)],
  ['Backend env example includes production API public URL', /API_PUBLIC_URL=/.test(backendEnv)],
  ['Backend env example includes tenant backup directory', /TENANT_BACKUP_DIR=/.test(backendEnv)],
  ['Backend env example includes CORS extra origins', /CORS_EXTRA_ORIGINS=/.test(backendEnv)],
  ['Backend env example includes webhook secret placeholder', /SAAS_WEBHOOK_SECRET=/.test(backendEnv)],
  ['Frontend env example points to API base path', /VITE_API_URL=.*\/api/.test(frontendEnv)],
  ['Backend production readiness script registered', Boolean(backendPkg.scripts['check:phase8e-production-readiness'])],
  ['Backend automated test includes production readiness', /check:phase8e-production-readiness/.test(backendPkg.scripts['test:automated'] || '')],
  ['Frontend production readiness script registered', Boolean(frontendPkg.scripts['check:phase8e-production'])],
  ['CI runs backend route load', /npm run check-routes/.test(ciWorkflow)],
  ['CI runs backend regression', /npm run test:regression/.test(ciWorkflow)],
  ['CI runs frontend build', /npm run build/.test(ciWorkflow)],
  ['Deployment doc includes rollback plan', /Rollback plan/i.test(deploymentDoc)],
  ['Deployment doc includes smoke test checklist', /Smoke test after deploy/i.test(deploymentDoc)],
  ['Production checklist references Phase 8E', /Phase 8E/i.test(read(path.join(docsRoot, 'PRODUCTION_CHECKLIST.md')))],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Phase 8E production readiness check failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`Phase 8E production readiness check passed (${checks.length}/${checks.length}).`);
