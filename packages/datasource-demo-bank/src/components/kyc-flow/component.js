/* eslint-disable import/no-unresolved -- runs inside the Forest app, which provides these */
/* eslint-env browser */
/**
 * "Retail onboarding, step by step": the picture is built by the agent (kyc-flow.js) as a
 * fixed-size stage; this component scales it to fill its cell, keeping its proportions, and plays
 * or pauses it on a click. The cell's size comes from the component's own grid size (Forest
 * updates it while the box is resized), not from the page: the cell's elements wrap their content.
 * Generated as hub/kyc-flow.{hbs,js,css}.
 */
import { action } from '@ember/object';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

// Forest's grid cell, in px (WORKSPACE_GRID_CELL_WIDTH and _HEIGHT).
const CELL = 20;
// The stage's size: kyc-flow.js writes it here at build time.
const STAGE = /* kyc-flow-stage */ { width: 944, height: 424 }; /* /kyc-flow-stage */
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default class KycFlow extends Component {
  @tracked paused = reducedMotion() || false;

  get stageClass() {
    return this.paused ? 'kf-stage kf-paused' : 'kf-stage';
  }

  get scale() {
    const box = this.args.component?.displaySettings;
    if (!box?.width || !box?.height) return 1;

    return Math.min((box.width * CELL) / STAGE.width, (box.height * CELL) / STAGE.height);
  }

  get wrapStyle() {
    const { scale } = this;

    return htmlSafe(`width:${STAGE.width * scale}px;height:${STAGE.height * scale}px`);
  }

  get stageStyle() {
    return htmlSafe(`transform:scale(${this.scale})`);
  }

  @action
  toggle() {
    this.paused = !this.paused;
  }
}
