// Generates the package.json for the Docker image's isolated runtime deps.
//
// It merges the external (non-@forestadmin) runtime dependencies of the BFF and
// its 4 workspace dependencies into a single manifest.
//
// The output is deterministic (sorted keys). A committed yarn.lock sits next to
// the generated manifest; the Docker build regenerates the manifest and runs
// `yarn install --frozen-lockfile`, so any workspace dependency change that the
// lock does not cover fails the build instead of silently drifting.
//
// Usage: node build-deps-manifest.js <packagesDir> <outFile>
//   <packagesDir>  directory containing the workspace packages (e.g. "packages")
//   <outFile>      path to write the merged package.json

const fs = require('fs');
const path = require('path');

const WORKSPACE_PACKAGES = [
  'agent-bff',
  'agent-client',
  'agent-toolkit',
  'datasource-toolkit',
  'forestadmin-client',
];

// Security pins for transitive deps whose parents never ship a patched range.
// They mirror the monorepo root's `resolutions` for the packages that actually
// appear in this closure — the isolated install does not inherit the root ones.
const RESOLUTIONS = {
  // superagent pins qs ^6.x (GHSA-hrpp-h998-j3pp prototype pollution).
  '**/qs': '>=6.15.2',
  // jsonapi-serializer pins lodash ^4.17.x.
  '**/lodash': '^4.18.0',
};

function generate(packagesDir, outFile) {
  // A flat install holds one version per dependency, so two packages asking for
  // different ranges is a decision, not something to let iteration order settle.
  // It has never happened here — refusing keeps it that way, and keeps the answer
  // out of this script.
  const deps = {};
  const declaredBy = {};

  for (const pkg of WORKSPACE_PACKAGES) {
    const manifestPath = path.join(packagesDir, pkg, 'package.json');
    const { dependencies = {} } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const [name, range] of Object.entries(dependencies)) {
      if (name.startsWith('@forestadmin/')) continue;

      if (deps[name] !== undefined && deps[name] !== range) {
        throw new Error(
          `Conflicting ranges for "${name}": ${deps[name]} (${declaredBy[name]}) and ` +
            `${range} (${pkg}). Align the version in the source packages.`,
        );
      }

      deps[name] = range;
      declaredBy[name] = pkg;
    }
  }

  const sorted = Object.fromEntries(Object.keys(deps).sort().map(key => [key, deps[key]]));

  const manifest = { name: 'agent-bff-docker-deps', private: true };

  // Carry the monorepo's pinned package manager so a manual lockfile refresh
  // (yarn install on this generated manifest) uses the same Yarn via Corepack,
  // not a contributor's global Yarn 4 which would emit an incompatible lockfile.
  // Resolved from the repo root relative to this script; absent in the Docker
  // build (root package.json isn't copied there) — harmless, the image uses its
  // own bundled Yarn 1.x.
  const packageManager = rootPackageManager();
  if (packageManager) manifest.packageManager = packageManager;

  manifest.dependencies = sorted;
  manifest.resolutions = RESOLUTIONS;

  fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
}

function rootPackageManager() {
  try {
    const root = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    );

    return root.packageManager;
  } catch {
    return undefined;
  }
}

if (require.main === module) {
  const [, , packagesDir, outFile] = process.argv;

  if (!packagesDir || !outFile) {
    console.error('Usage: node build-deps-manifest.js <packagesDir> <outFile>');
    process.exit(1);
  }

  generate(packagesDir, outFile);
}

module.exports = { WORKSPACE_PACKAGES, generate };
