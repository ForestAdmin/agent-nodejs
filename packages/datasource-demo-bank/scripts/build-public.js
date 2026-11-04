/**
 * Generates the demo's Custom component files into dist/public/hub/, from src/components/ and the
 * content the data source holds (the desks, the feature explainers): what the Forest CLI's demo
 * layout loads from a CDN serving this package (…/datasource-demo-bank@<major>/dist/public/hub/…).
 * The agent serves no files, so they are built once, with the package, and never committed.
 *
 *     node scripts/build-public.js [out folder, default dist/public]
 *
 * It stops if a file renders empty.
 */
const fs = require('fs');
const path = require('path');

const { FEATURES, renderFeatureFile } = require('../src/charts/features');
const { renderHubFile } = require('../src/charts/hub');

const SELECT_FIRST = path.join(__dirname, '..', 'src', 'components', 'select-first');

/** Every file name the demo layout can load from …/hub/. */
function publicFiles() {
  // The Hub, and its "← Hub" button.
  const hub = ['template.hbs', 'component.js', 'style.css', 'back.hbs', 'back.js'];
  // The desks' buttons and guides: their own names, and select-first.* for the Select a case button.
  const desk = fs
    .readdirSync(SELECT_FIRST)
    .filter(f => !['template.hbs', 'component.js', 'style.css'].includes(f));
  const selectFirst = ['select-first.hbs', 'select-first.js', 'select-first.css'];
  const kycFlow = ['kyc-flow.hbs', 'kyc-flow.js', 'kyc-flow.css'];
  const features = ['feature.hbs', 'feature.css', ...FEATURES.map(f => `feature-${f.key}.js`)];

  return [...hub, ...desk, ...selectFirst, ...kycFlow, ...features];
}

function render(name) {
  return name.startsWith('feature') ? renderFeatureFile(name) : renderHubFile(name);
}

function buildPublic(out) {
  const folder = path.join(out, 'hub');
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });
  const empty = [];
  const names = publicFiles();
  names.forEach(name => {
    const text = render(name);
    if (!text) empty.push(name);
    else fs.writeFileSync(path.join(folder, name), text);
  });
  if (empty.length) throw new Error(`nothing renders ${empty.join(', ')}`);

  return names;
}

if (require.main === module) {
  const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'public'));
  const names = buildPublic(out);
  // eslint-disable-next-line no-console
  console.log(`${names.length} component files → ${path.join(out, 'hub')}`);
}

module.exports = { buildPublic, publicFiles };
