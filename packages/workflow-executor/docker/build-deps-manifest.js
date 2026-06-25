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
  const deps = {};

  for (const pkg of WORKSPACE_PACKAGES) {
    const manifestPath = path.join(packagesDir, pkg, 'package.json');
    const { dependencies = {} } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const [name, version] of Object.entries(dependencies)) {
      if (!name.startsWith('@forestadmin/')) deps[name] = version;
    }
  }

  Object.assign(deps, OTEL_DEPENDENCIES);

  const sorted = Object.fromEntries(Object.keys(deps).sort().map(key => [key, deps[key]]));

  fs.writeFileSync(
    outFile,
    `${JSON.stringify({ name: 'workflow-executor-docker-deps', private: true, dependencies: sorted }, null, 2)}\n`,
  );
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
