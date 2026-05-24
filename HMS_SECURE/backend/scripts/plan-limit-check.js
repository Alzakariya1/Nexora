const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assertContains = (file, needle, label) => {
  const content = read(file);
  if (!content.includes(needle)) throw new Error(`${label || needle} missing in ${file}`);
};

assertContains('src/utils/subscription.js', 'guardrails', 'subscription guardrails');
assertContains('src/utils/subscription.js', 'warning:', 'usage warning threshold');
assertContains('src/utils/subscription.js', 'remaining:', 'remaining limit calculation');
assertContains('src/routes/subscription.routes.js', "/subscription/guardrails", 'tenant guardrail endpoint');
assertContains('src/routes/patient.routes.js', "ensureWithinLimit(req.tenant?.hospital_id || req.user?.hospital_id, 'patients', 1)", 'patient create plan limit');
assertContains('src/routes/core.routes.js', "ensureWithinLimit(req.tenant?.hospital_id || req.user?.hospital_id, 'doctors', 1)", 'doctor create plan limit');
assertContains('src/routes/core.routes.js', "ensureWithinLimit(req.tenant?.hospital_id || req.user?.hospital_id, 'appointments_per_month', 1)", 'appointment monthly plan limit');
assertContains('src/routes/pharmacy.routes.js', "ensureWithinLimit(req.tenant?.hospital_id || req.user?.hospital_id, 'medicines', 1)", 'medicine create plan limit');
console.log('Plan limit guardrail check passed');
