/* eslint-disable import/no-unresolved -- runs inside the Forest app, which provides these */
/* eslint-env browser */
/**
 * Select first: a workspace Custom component, one button that picks a row of a native collection
 * component, as a click on that row would: the first one, or the one with a given reference. Served
 * as hub/select-first.{hbs,js,css} (select-first-files.js).
 *
 * Set in the component's own url: `select-first.js?list=List_Untreated&ref=KYC-DEMO-0001&label=…`
 * (list: default List_Untreated; ref: the row's reference, default the first row; label: the
 * button's text). The text's size follows the button's box (fittedFont).
 *
 * `after=KYC-DEMO-0001` locks the button (grey, a hint on hover) until that row of the list shows
 * one of `afterStatus` (comma-separated, default APPROVED): the demo's second case waits for the
 * first. The list is read
 * again every LOCK_POLL_MS, so the button opens as soon as the list refreshes after the action.
 *
 * What a row click does in Forest's collection component, done here the same way: select the row
 * in the list's records context (the highlight), publish it as the component's selectedRecord
 * (fields, buttons and workflows that follow the list), then the full record, fetched as the list
 * fetches it.
 */
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const DEFAULT_LIST = 'List_Untreated';
const DEFAULT_LABEL = 'Select a KYC Case';
const DEFAULT_TIP = 'Complete the first case before moving on to the second one!';
const LOCK_POLL_MS = 1500;
// Forest's grid cell, in px (WORKSPACE_GRID_CELL_WIDTH and _HEIGHT).
const CELL = 20;

/**
 * A font size that fits `text` on one line in the component's box: at most 40% of its height,
 * and narrow enough for the whole text (600 weight: about 0.6 em a character, 44 px of padding).
 */
function fittedFont(component, text, { min = 11, max = 36 } = {}) {
  const box = component?.displaySettings;
  if (!box?.width || !box?.height) return null;
  const byHeight = box.height * CELL * 0.4;
  const byWidth = (box.width * CELL - 44) / (0.6 * Math.max(String(text).length, 1));

  return Math.round(Math.max(min, Math.min(max, byHeight, byWidth)));
}

/**
 * The hint bubble's text size: the largest that fits the whole hint inside the box, on one, two
 * or three lines (the bubble covers the button; Forest's cell cuts anything outside it).
 */
function tipFont(component, text) {
  const box = component?.displaySettings;
  if (!box?.width || !box?.height) return null;
  const length = Math.max(String(text || '').length, 1);
  const best = Math.max(
    ...[1, 2, 3].map(lines =>
      // Lines of 1.3 em plus 0.6 em of padding; 0.62 em a character (bold) plus 1.4 em of padding.
      Math.min(
        (box.height * CELL * 0.92) / (lines * 1.3 + 0.6),
        (box.width * CELL * 0.94) / (0.62 * Math.ceil(length / lines) + 1.4),
      ),
    ),
  );

  return Math.round(Math.max(12, Math.min(30, best)));
}

const listOf = rows => (rows && rows.toArray ? rows.toArray() : Array.from(rows || []));
// A row's fields are its "forest-<field>" attributes (Forest's model namespace).
const fieldOf = (row, name) =>
  row?.[`forest-${name}`] ?? row?.getAttributesSerialized?.()[name] ?? row?.[name];
const referenceOf = row => fieldOf(row, 'reference');

export default class SelectFirst extends Component {
  @service('feature/client-record') clientRecordFeature;

  @tracked busy = false;

  @tracked note = null;

  // Bumped every LOCK_POLL_MS while the button waits on another row, so `locked` reads again.
  @tracked tick = 0;

  constructor(owner, args) {
    super(owner, args);

    if (this.params.get('after')) {
      this.timer = window.setInterval(() => {
        this.tick += 1;
      }, LOCK_POLL_MS);
    }
  }

  willDestroy(...args) {
    super.willDestroy?.(...args);
    window.clearInterval(this.timer);
  }

  get params() {
    const url = this.args.component?.options?.componentUrl || '';

    return new URLSearchParams(url.split('?')[1] || '');
  }

  get listName() {
    return this.params.get('list') || DEFAULT_LIST;
  }

  get reference() {
    return this.params.get('ref');
  }

  get text() {
    return this.note || this.params.get('label') || DEFAULT_LABEL;
  }

  get buttonStyle() {
    const size = fittedFont(this.args.component, this.text);

    return size ? htmlSafe(`font-size:${size}px`) : null;
  }

  get list() {
    return this.args.component?.getWorkspaceComponentFromName?.(this.listName) || null;
  }

  /** Waiting on another row: the one named by `after` has not reached `afterStatus` yet. */
  get locked() {
    const after = this.params.get('after');
    if (!after) return false;
    // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions -- read to recompute on each poll
    this.tick;
    const rows = listOf(this.list?.options?.recordsContext?.records);
    const row = rows.find(r => referenceOf(r) === after);

    const wanted = (this.params.get('afterStatus') || 'APPROVED').split(',');

    return !wanted.includes(fieldOf(row, 'status'));
  }

  get tip() {
    return this.locked ? this.params.get('tip') || DEFAULT_TIP : null;
  }

  get tipStyle() {
    const size = this.tip ? tipFont(this.args.component, this.tip) : null;

    return size ? htmlSafe(`font-size:${size}px`) : null;
  }

  get rootClass() {
    return this.locked ? 'sf sf--locked' : 'sf';
  }

  get buttonClass() {
    if (this.busy) return 'sf-button sf-button--busy';

    return this.note ? 'sf-button sf-button--note' : 'sf-button';
  }

  @action
  async selectFirst() {
    const { list } = this;
    if (this.locked) return;
    const context = list?.options?.recordsContext;
    const rows = listOf(context?.records);
    const { reference } = this;
    const first = reference ? rows.find(row => referenceOf(row) === reference) : rows[0];

    if (!first) {
      let why = 'No case in the list right now';
      if (!list) why = `No component named ${this.listName}`;
      else if (reference && rows.length) why = `${reference} is not in the list`;
      this.note = why;
      if (!context) console.warn(`select-first: ${this.listName} has no records loaded`);

      return;
    }

    this.note = null;
    this.busy = true;

    try {
      listOf(list.appliedOn).forEach(c => {
        if (c?.options && 'resetReadMode' in c.options) c.options.resetReadMode();
      });
      context.resetSelectedRecords();
      context.areAllRecordsSelected = false;
      context.selectRecord(first);
      list.selectedRecords = [first];
      list.selectedRecords = [
        await this.clientRecordFeature.fetchRecordAndRequiredBelongsTo(
          list.templatingRecordFetch,
          list.options.filteredCollection,
          first,
        ),
      ];
    } catch (error) {
      console.warn('select-first: the full record could not be fetched', error);
    } finally {
      this.busy = false;
    }
  }
}
