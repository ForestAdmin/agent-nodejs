/* eslint-disable import/no-unresolved -- runs inside the Forest app, which provides these */
/* eslint-env browser */
/**
 * Go to: a workspace Custom component, one button that opens another workspace, in the same look
 * as the Select first button (it shares select-first.css). The target and the text are in the
 * component's own url: `go-to.js?workspace=<workspace id>&label=<text>`. Served by the agent as
 * hub/go-to.{hbs,js} (select-first-files.js). The text's size follows the button's box.
 *
 * As Select first, `after=KYC-DEMO-0002&afterStatus=PENDING_APPROVAL,APPROVED` (and `list`,
 * default List_Untreated; `tip`) keeps it grey, with a hint on hover, until that row of the list
 * shows one of those statuses: the senior's desk opens once case 2 was escalated.
 *
 * `unlock=simplified|senior` waits on the visitor instead: the agent's demo_guide chart answers
 * `unlocked` (an action run on the Simplified desk; a case decided on the senior's).
 *
 * `look=back` draws it as the desks' "← Hub" pill: a way back, not the next step. `look=link`
 * draws it as a native link component's text (`color`, `size` in px, `weight`, `align`): what a
 * link to a workspace becomes in a template that cannot know the project's name (its url).
 */
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

/** look=link: the native link's text settings, each kept only when it is a plain value. */
function linkStyle(params) {
  const keep = (name, pattern, css) =>
    pattern.test(params.get(name) || '') ? css(params.get(name)) : '';

  return [
    keep('color', /^#[0-9a-f]{3,8}$/i, v => `color:${v}`),
    keep('size', /^\d{1,3}$/, v => `font-size:${v}px`),
    keep('weight', /^(normal|bold|[1-9]00)$/, v => `font-weight:${v}`),
    keep('align', /^(left|center|right)$/, v => `text-align:${v}`),
  ]
    .filter(Boolean)
    .join(';');
}

// Forest's grid cell, in px (WORKSPACE_GRID_CELL_WIDTH and _HEIGHT).
const CELL = 20;
const LOCK_POLL_MS = 1500;
const DEFAULT_TIP = 'Escalate the second case to a senior officer first!';
const UNLOCK_TIPS = {
  simplified: 'Try at least one action first, like "Change preferred language"!',
  senior: 'Decide at least one case first!',
};
const listOf = rows => (rows && rows.toArray ? rows.toArray() : Array.from(rows || []));
// A row's fields are its "forest-<field>" attributes (Forest's model namespace).
const fieldOf = (row, name) =>
  row?.[`forest-${name}`] ?? row?.getAttributesSerialized?.()[name] ?? row?.[name];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** As select-first's: one line, at most 40% of the box's height, the whole text in its width. */
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

export default class GoTo extends Component {
  @service router;

  @service lianaServerFetch;

  // The agent's answer for `unlock=`: null until it comes.
  @tracked unlockedByAgent = null;

  // Bumped every LOCK_POLL_MS while the button waits on a row, so `locked` reads again.
  @tracked tick = 0;

  constructor(owner, args) {
    super(owner, args);

    if (this.params.get('after') || this.params.get('unlock')) {
      this.timer = window.setInterval(() => {
        this.tick += 1;
        this.askAgent();
      }, LOCK_POLL_MS);
      this.askAgent();
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

  get label() {
    return this.params.get('label') || 'Open the next workspace';
  }

  /** For `unlock=`: does the agent say the visitor did what opens this button? */
  async askAgent() {
    const desk = this.params.get('unlock');
    if (!desk || this.unlockedByAgent) return;

    try {
      const response = await this.lianaServerFetch.fetch(
        `/forest/_charts/demo_guide?desk=${encodeURIComponent(desk)}`,
        {},
      );
      if (response.ok) this.unlockedByAgent = Boolean((await response.json())?.unlocked);
    } catch (error) {
      // The next poll asks again.
    }
  }

  /**
   * Waiting: on the agent (`unlock=`), or on a row of the list (the one named by `after` has
   * none of `afterStatus` yet).
   */
  get locked() {
    if (this.params.get('unlock')) return !this.unlockedByAgent;
    const after = this.params.get('after');
    if (!after) return false;
    // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions -- read to recompute on each poll
    this.tick;
    const list = this.args.component?.getWorkspaceComponentFromName?.(
      this.params.get('list') || 'List_Untreated',
    );
    const row = listOf(list?.options?.recordsContext?.records).find(
      r => fieldOf(r, 'reference') === after,
    );
    const wanted = (this.params.get('afterStatus') || 'APPROVED').split(',');

    return !wanted.includes(fieldOf(row, 'status'));
  }

  get tip() {
    if (!this.locked) return null;

    return this.params.get('tip') || UNLOCK_TIPS[this.params.get('unlock')] || DEFAULT_TIP;
  }

  get buttonClass() {
    const look = this.params.get('look');
    if (look === 'back') return 'sf-button sf-button--back';

    return look === 'link' ? 'sf-button sf-button--link' : 'sf-button';
  }

  get tipStyle() {
    const size = this.tip ? tipFont(this.args.component, this.tip) : null;

    return size ? htmlSafe(`font-size:${size}px`) : null;
  }

  get rootClass() {
    return this.locked ? 'sf sf--locked' : 'sf';
  }

  get buttonStyle() {
    if (this.params.get('look') === 'link') return htmlSafe(linkStyle(this.params));
    const size = fittedFont(this.args.component, this.label);

    return size ? htmlSafe(`font-size:${size}px`) : null;
  }

  /** The current url with the workspace id swapped (as the Hub's buttons do). */
  get path() {
    const target = this.params.get('workspace');
    const path = window.location.pathname;
    const ids = path.match(UUID) || [];
    const current = ids[ids.length - 1];
    if (!target || !current) return null;
    const at = path.lastIndexOf(current);

    return `${path.slice(0, at)}${target}`;
  }

  @action
  open() {
    const { path } = this;
    if (!path || this.locked) return;

    try {
      const transition = this.router.transitionTo(path);
      transition?.catch?.(error => {
        if (error?.name !== 'TransitionAborted') window.location.assign(path);
      });
    } catch (error) {
      window.location.assign(path);
    }
  }
}
