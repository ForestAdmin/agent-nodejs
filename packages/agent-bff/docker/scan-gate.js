// Reports the image's library (npm) vulnerabilities.
//
// Trivy splits findings into OS packages (gated natively in the workflow, blocking —
// only fixable by bumping the base image here) and libraries. The libraries here are
// the BFF's npm dependencies, already shipped to npm consumers — blocking the image
// would desync GHCR from npm without removing the vuln, which is fixed at the source
// via a dependency bump — plus the npm CLI the base image bundles, fixed by bumping
// that base image. Neither is fixable in this Dockerfile → REPORT only.
//
// The image ships no Docker-only npm dependency today. The day it does (APM), that
// dependency exists ONLY here and can only be fixed here — it must then BLOCK, the
// way the workflow-executor image gates its @opentelemetry packages.
//
// Usage: node scan-gate.js <trivy-library-results.json>

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

console.log('\nEvery library finding above is report-only — this step gates nothing today.');
