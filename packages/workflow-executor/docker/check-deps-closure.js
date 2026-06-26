// Guard-rail against silent drift in the Docker image's @forestadmin closure.
//
// The image's runtime deps are assembled from a HARDCODED set in two places:
//   - WORKSPACE_PACKAGES in build-deps-manifest.js (gathers their external deps)
//   - the `COPY --from=builder .../dist` lines in the Dockerfile (ships their build)
//
// If the executor gains/loses an @forestadmin/* dependency, both must change or the
// runtime image breaks at startup (Cannot find module) — invisible to a build-only CI.
// This check recomputes the real transitive @forestadmin closure of workflow-executor
// and fails if the hardcoded list or the Dockerfile COPYs don't match it.
//
// Usage: node check-deps-closure.js   (exits non-zero on drift)

const fs = require('fs');
const path = require('path');
const { WORKSPACE_PACKAGES } = require('./build-deps-manifest');

const PACKAGES_DIR = path.resolve(__dirname, '../..');
const DOCKERFILE = path.resolve(__dirname, '../Dockerfile');
const ROOT_PACKAGE = '@forestadmin/workflow-executor';

// Map every @forestadmin/* package name to its directory under packages/.
const nameToDir = {};
for (const dir of fs.readdirSync(PACKAGES_DIR)) {
  const manifestPath = path.join(PACKAGES_DIR, dir, 'package.json');
  if (!fs.existsSync(manifestPath)) continue;
  const { name } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (name) nameToDir[name] = dir;
}

// BFS the transitive @forestadmin closure (including the root itself).
const closure = new Set();
const queue = [ROOT_PACKAGE];
while (queue.length) {
  const name = queue.shift();
  const dir = nameToDir[name];
  if (!dir || closure.has(dir)) continue;
  closure.add(dir);
  const { dependencies = {} } = JSON.parse(
    fs.readFileSync(path.join(PACKAGES_DIR, dir, 'package.json'), 'utf8'),
  );
  for (const dep of Object.keys(dependencies)) {
    if (dep.startsWith('@forestadmin/')) queue.push(dep);
  }
}

const actual = [...closure].sort();
const declared = [...WORKSPACE_PACKAGES].sort();
const dockerfile = fs.readFileSync(DOCKERFILE, 'utf8');

const errors = [];

const missingFromList = actual.filter(p => !declared.includes(p));
const extraInList = declared.filter(p => !actual.includes(p));
if (missingFromList.length) errors.push(`WORKSPACE_PACKAGES is missing: ${missingFromList.join(', ')}`);
if (extraInList.length) errors.push(`WORKSPACE_PACKAGES has stale entries: ${extraInList.join(', ')}`);

// Every closure package except the executor itself must be copied into node_modules.
for (const pkg of actual) {
  if (pkg === 'workflow-executor') continue;
  if (!dockerfile.includes(`/app/packages/${pkg}/dist`)) {
    errors.push(`Dockerfile is missing a COPY for packages/${pkg}/dist`);
  }
}

if (errors.length) {
  console.error('@forestadmin dependency closure drift detected:\n  - ' + errors.join('\n  - '));
  console.error(`\nActual closure: ${actual.join(', ')}`);
  console.error('Update WORKSPACE_PACKAGES (build-deps-manifest.js) and the Dockerfile COPY lines to match.');
  process.exit(1);
}

console.log(`@forestadmin closure OK (${actual.length} packages): ${actual.join(', ')}`);
