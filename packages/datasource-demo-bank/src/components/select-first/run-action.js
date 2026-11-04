/* eslint-disable import/no-unresolved -- runs inside the Forest app, which provides these */
/* eslint-env browser */
/**
 * Run action: a workspace Custom component, one button that runs a Global Smart Action through
 * Forest's own flow (its form or confirmation, the result card, the lists refreshed, the activity
 * log), in the look of the other desk buttons (select-first.css, dark). Set in its own url:
 * `run-action.js?collection=kyc_cases&action=Reset the demo cases&label=…`. Served by the agent as
 * hub/run-action.{hbs,js} (select-first-files.js).
 */
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

// Forest's grid cell, in px (WORKSPACE_GRID_CELL_WIDTH and _HEIGHT).
const CELL = 20;

/** As select-first's: one line, at most 40% of the box's height, the whole text in its width. */
function fittedFont(component, text, { min = 11, max = 36 } = {}) {
  const box = component?.displaySettings;
  if (!box?.width || !box?.height) return null;
  const byHeight = box.height * CELL * 0.4;
  const byWidth = (box.width * CELL - 44) / (0.6 * Math.max(String(text).length, 1));

  return Math.round(Math.max(min, Math.min(max, byHeight, byWidth)));
}

const listOf = rows => (rows && rows.toArray ? rows.toArray() : Array.from(rows || []));

export default class RunAction extends Component {
  @service store;

  @tracked busy = false;

  @tracked note = null;

  get params() {
    const url = this.args.component?.options?.componentUrl || '';

    return new URLSearchParams(url.split('?')[1] || '');
  }

  get actionName() {
    return this.params.get('action') || '';
  }

  get text() {
    if (this.busy) return 'Running…';

    return this.note || this.params.get('label') || this.actionName || 'Run';
  }

  get buttonClass() {
    if (this.busy) return 'sf-button sf-button--dark sf-button--busy';

    return this.note ? 'sf-button sf-button--note' : 'sf-button sf-button--dark';
  }

  get buttonStyle() {
    const size = fittedFont(this.args.component, this.params.get('label') || this.actionName);

    return size ? htmlSafe(`font-size:${size}px`) : null;
  }

  /** The action's model, as Forest's own buttons hold it. */
  get smartAction() {
    const name = this.params.get('collection');
    const collection = listOf(this.store.peekAll('collection')).find(c => c.name === name);

    return listOf(collection?.customActions).find(a => a.name === this.actionName) || null;
  }

  @action
  async run() {
    if (this.busy) return;
    const { smartAction } = this;

    if (!smartAction) {
      this.note = `No action "${this.actionName}" here`;

      return;
    }

    this.note = null;
    this.busy = true;

    try {
      await this.args.triggerCustomAction(smartAction, []);
    } catch (error) {
      console.warn(`run-action: ${this.actionName} failed`, error);
    } finally {
      this.busy = false;
    }
  }
}
