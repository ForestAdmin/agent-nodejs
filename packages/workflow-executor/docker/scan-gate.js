// Gates the image publish on library (npm) vulnerabilities by ORIGIN, not severity.
//
// Trivy splits findings into OS packages (gated natively, blocking — only fixable
// by bumping the base image here) and libraries. Among libraries:
//   - @opentelemetry/* are Docker-only (pinned in build-deps-manifest.js): the
//     image is the ONLY place they exist and can be fixed → BLOCK.
//   - everything else is the executor's npm dependencies, already shipped via the
//     npm package: blocking the image would desync GHCR from npm without removing
//     the vuln (fixed at the source via a dependency bump) → REPORT only.
//
// Usage: node scan-gate.js <trivy-library-results.json>   (exits 1 if a blocking
// OTel vuln is found; always prints every library finding for visibility)

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node scan-gate.js <trivy-results.json>');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const findings = (report.Results || [])
  .flatMap(r => r.Vulnerabilities || [])
  .map(v => ({
    id: v.VulnerabilityID,
    pkg: v.PkgName,
    severity: v.Severity,
    installed: v.InstalledVersion,
    fixed: v.FixedVersion || '(none)',
  }));

const lines = ['## Image dependency scan (CRITICAL,HIGH, fixable)', ''];
if (findings.length === 0) {
  lines.push('No library vulnerabilities found.');
} else {
  lines.push('| Package | Severity | ID | Installed | Fixed |', '|---|---|---|---|---|');
  for (const f of findings) {
    lines.push(`| ${f.pkg} | ${f.severity} | ${f.id} | ${f.installed} | ${f.fixed} |`);
  }
}
const summary = lines.join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);

// Block only on Docker-only OTel packages — everything else is report-only.
const blocking = findings.filter(f => f.pkg.startsWith('@opentelemetry/'));
if (blocking.length) {
  console.error(
    `\n::error::${blocking.length} fixable vuln(s) in Docker-only @opentelemetry packages must be ` +
      'fixed here (bump versions in build-deps-manifest.js): ' +
      blocking.map(f => `${f.pkg}@${f.installed} (${f.id})`).join(', '),
  );
  process.exit(1);
}

console.log('\nNo blocking (Docker-only) library vulnerabilities — npm-shared deps are report-only.');
