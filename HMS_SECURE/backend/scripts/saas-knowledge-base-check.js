const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assertIncludes(file, needle, label) {
  if (!read(file).includes(needle)) {
    throw new Error(`${label} missing in ${file}`);
  }
}

assertIncludes('src/models/index.js', 'KnowledgeBaseArticle', 'KnowledgeBaseArticle model');
assertIncludes('src/models/index.js', 'knowledge_base_articles', 'knowledge base collection');
assertIncludes('src/server.js', 'saas-knowledge-base.routes', 'knowledge base route registration');
assertIncludes('src/routes/saas-knowledge-base.routes.js', '/saas/knowledge-base/public', 'public portal endpoint');
assertIncludes('src/routes/saas-knowledge-base.routes.js', 'allowRoles(\'super_admin\')', 'super admin guard');
assertIncludes('src/routes/saas-knowledge-base.routes.js', 'requirePermission(\'hospital.manage\')', 'permission guard');
assertIncludes('../frontend/src/api/saasApi.js', 'knowledgeBase', 'frontend knowledge base API');
assertIncludes('../frontend/src/pages/SaasControl.jsx', 'Knowledge base & self-service help center', 'SaaS UI knowledge base panel');
console.log('SaaS knowledge base readiness check passed.');
