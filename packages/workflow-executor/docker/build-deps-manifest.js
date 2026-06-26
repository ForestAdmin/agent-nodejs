// Generates the package.json for the Docker image's isolated runtime deps.
//
// It merges the external (non-@forestadmin) runtime dependencies of the executor
// and its 5 workspace dependencies into a single manifest, plus the OpenTelemetry
// packages used for APM (Docker-only; not shipped to npm consumers of the CLI).
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
  'workflow-executor',
  'agent-client',
  'ai-proxy',
  'forestadmin-client',
  'datasource-toolkit',
  'agent-toolkit',
];

// Pinned to exact versions — OTel ships only in the Docker image.
const OTEL_DEPENDENCIES = {
  '@opentelemetry/sdk-node': '0.219.0',
  '@opentelemetry/auto-instrumentations-node': '0.77.0',
  '@opentelemetry/exporter-trace-otlp-http': '0.219.0',
};

function generate(packagesDir, outFile) {
  // Collect every declared range per external dependency, tracking which packages
  // ask for it — a flat install can hold only one version, so we must resolve
  // disagreements deliberately rather than let iteration order decide.
  const declared = {};
  for (const pkg of WORKSPACE_PACKAGES) {
    const manifestPath = path.join(packagesDir, pkg, 'package.json');
    const { dependencies = {} } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const [name, range] of Object.entries(dependencies)) {
      if (name.startsWith('@forestadmin/')) continue;
      declared[name] = declared[name] || {};
      (declared[name][range] = declared[name][range] || []).push(pkg);
    }
  }

  const deps = {};
  for (const [name, byRange] of Object.entries(declared)) {
    const ranges = Object.keys(byRange);
    if (ranges.length === 1) {
      [deps[name]] = ranges;
      continue;
    }

    // Conflicting ranges. The image IS the executor, so its own pin is
    // authoritative (its tested version); any other conflict must be aligned by
    // a human rather than silently collapsed.
    const executorRange = ranges.find(r => byRange[r].includes('workflow-executor'));
    if (!executorRange) {
      const detail = ranges.map(r => `${r} (${byRange[r].join(', ')})`).join('; ');
      throw new Error(
        `Conflicting ranges for "${name}" not arbitrated by workflow-executor: ${detail}. ` +
          'Align the version in the source packages.',
      );
    }
    console.warn(
      `[build-deps] "${name}": conflicting ranges (${ranges.join(', ')}); ` +
        `using the executor's pin "${executorRange}".`,
    );
    deps[name] = executorRange;
  }

  Object.assign(deps, OTEL_DEPENDENCIES);

  const sorted = Object.fromEntries(Object.keys(deps).sort().map(key => [key, deps[key]]));

  const manifest = { name: 'workflow-executor-docker-deps', private: true };

  // Carry the monorepo's pinned package manager so a manual lockfile refresh
  // (yarn install on this generated manifest) uses the same Yarn via Corepack,
  // not a contributor's global Yarn 4 which would emit an incompatible lockfile.
  // Resolved from the repo root relative to this script; absent in the Docker
  // build (root package.json isn't copied there) — harmless, the image uses its
  // own bundled Yarn 1.x.
  const packageManager = rootPackageManager();
  if (packageManager) manifest.packageManager = packageManager;

  manifest.dependencies = sorted;

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

module.exports = { WORKSPACE_PACKAGES, OTEL_DEPENDENCIES, generate };
