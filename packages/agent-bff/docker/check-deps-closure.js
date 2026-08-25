// Guard-rail against silent drift in the Docker image's @forestadmin closure.
//
// The image's runtime deps are assembled from a HARDCODED set in two places:
//   - WORKSPACE_PACKAGES in build-deps-manifest.js (gathers their external deps)
//   - the `COPY --from=builder .../dist` lines in the Dockerfile (ships their build)
//
// If the BFF gains/loses an @forestadmin/* dependency, both must change or the
// runtime image breaks at startup (Cannot find module) — invisible to a build-only CI.
// This check recomputes the real transitive @forestadmin closure of agent-bff
// and fails if the hardcoded list or the Dockerfile COPYs don't match it.
//
// Usage: node check-deps-closure.js   (exits non-zero on drift)

const fs = require('fs');
const path = require('path');
const { WORKSPACE_PACKAGES } = require('./build-deps-manifest');

const PACKAGES_DIR = path.resolve(__dirname, '../..');
const DOCKERFILE = path.resolve(__dirname, '../Dockerfile');
const ROOT_PACKAGE = '@forestadmin/agent-bff';

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

  // An @forestadmin package that lives outside this monorepo would fall through every
  // mechanism the image has: the walk cannot reach its dependencies, build-deps-manifest
  // skips the whole @forestadmin/ prefix when gathering external deps, and there is no
  // dist to COPY. It would be absent from the image entirely, so refuse rather than
  // report a clean closure.
  if (!dir) {
    console.error(`Unknown @forestadmin dependency "${name}": no package under packages/ declares it.`);
    console.error('The Docker image can only ship workspace packages — vendor it or add it to the monorepo.');
    process.exit(1);
  }

  if (closure.has(dir)) continue;
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

// Only active COPY instructions count — a path that survives in a comment or in prose
// would otherwise pass the check while shipping nothing.
const copied = dockerfile
  .split('\n')
  .filter(line => /^\s*COPY\s/.test(line))
  .join('\n');

// Every closure package is copied out of the builder, and BOTH halves are required:
// without the dist there is no code, and without the package.json there is no "main"
// for Node to resolve the package by. The dependencies land in node_modules and the BFF
// in packages/agent-bff/, but they are all copied FROM the same builder paths.
for (const pkg of actual) {
  for (const file of ['dist', 'package.json']) {
    if (!copied.includes(`/app/packages/${pkg}/${file}`)) {
      errors.push(`Dockerfile is missing a COPY for packages/${pkg}/${file}`);
    }
  }
}

if (errors.length) {
  console.error('@forestadmin dependency closure drift detected:\n  - ' + errors.join('\n  - '));
  console.error(`\nActual closure: ${actual.join(', ')}`);
  console.error('Update WORKSPACE_PACKAGES (build-deps-manifest.js) and the Dockerfile COPY lines to match.');
  process.exit(1);
}

console.log(`@forestadmin closure OK (${actual.length} packages): ${actual.join(', ')}`);
