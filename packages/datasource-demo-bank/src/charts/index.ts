/**
 * The data source's API charts, read by the demo's Custom components through Forest
 * (GET /forest/_charts/<name>): the desks' weekly figures, the guides' facts, the Hub's counts, the
 * Data model, the feature explainers, the records' network.
 */
import { addDataMapChart } from './data-map';
import { addDemoGuideChart } from './demo-guide';
import { addDeskCharts } from './desk-charts';
import { addFeatureChart } from './features';
import { addHubChart } from './hub';
import { addNetworkCharts } from './network';

function addCharts(customizer) {
  // The KYC Case desk's guide: which demo steps a case has done (demo_guide).
  addDemoGuideChart(customizer);
  // The "Data model" workspace: domains, tables, links, actions, rows (data_map).
  addDataMapChart(customizer);
  // The desks' weekly charts: lead times, conversions, volumes.
  addDeskCharts(customizer);
  // The Hub's live counts (hub_counts).
  addHubChart(customizer);
  // The feature explainers' live figures (feature_facts).
  addFeatureChart(customizer);
  // A record's network (the Analytics tab's Smart Chart).
  addNetworkCharts(customizer);
}

// eslint-disable-next-line import/prefer-default-export
export { addCharts };
