/**
 * The data source's API charts (GET /forest/_charts/<name>): the teams' weekly figures, the KYC
 * story's progress, the queue counts, the data model's map and a few headline figures.
 */
import { addDataMapChart } from './data-map';
import { addDemoGuideChart } from './demo-guide';
import { addDeskCharts } from './desk-charts';
import { addFeatureChart } from './features';
import { addHubChart } from './hub';

function addCharts(customizer) {
  // Which steps of the demo's KYC story a case has gone through (demo_guide).
  addDemoGuideChart(customizer);
  // The data model by domain: tables, links, Smart Actions, rows (data_map).
  addDataMapChart(customizer);
  // The teams' weekly figures: lead times, conversions, volumes.
  addDeskCharts(customizer);
  // The tasks waiting in every queue (hub_counts).
  addHubChart(customizer);
  // A few tables' sizes and the queues' counts (feature_facts).
  addFeatureChart(customizer);
}

// eslint-disable-next-line import/prefer-default-export
export { addCharts };
