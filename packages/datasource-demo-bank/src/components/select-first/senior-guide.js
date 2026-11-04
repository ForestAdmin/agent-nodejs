/* eslint-disable import/no-unresolved -- runs inside the Forest app, which provides these */
/* eslint-env browser */
/**
 * Senior guide: a workspace Custom component for the senior officer's desk. It explains the
 * "Senior sign-off" queue and follows the demo cases in it (KYC-DEMO-0003, -0004, then -0002 once
 * sent from the KYC Case desk): each one waiting, decided, or not sent yet, read every POLL_MS from
 * the agent's API chart `demo_guide?desk=senior`. Styled by demo-guide.css.
 *
 * Its three how-to steps tick themselves: a case taken (the desk's inbox, `?inbox=`, default
 * SeniorInbox, has a record picked), Senior review running on it (Forest's workflow service), then
 * Next ticket in the inbox banner (a second case decided).
 */
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const POLL_MS = 2000;
// Forest's grid cell, in px (WORKSPACE_GRID_CELL_WIDTH and _HEIGHT).
const CELL = 20;
// The guide's content is about this many lines of its base size tall, and this many wide.
const EM_TALL = 40;
const EM_WIDE = 32;

// Forest's own inbox banner, once a review is done.
const NEXT_TICKET_STEP = {
  title: 'Click Next ticket',
  detail: 'When a review ends, the inbox banner offers the next case: click Next ticket.',
};
const HOW = [
  {
    title: 'Click Start processing',
    detail: 'The inbox hands you the oldest request first, and keeps it yours while you work.',
  },
  {
    title: 'Run ▶ Senior review',
    detail:
      'Read the risk, say why in one or two sentences, then approve, ask for a proof of funds, or reject.',
  },
];

const WORKFLOW = 'Senior review';
const listOf = rows => (rows?.toArray ? rows.toArray() : Array.from(rows || []));

const STATES = {
  waiting: ['Waiting', 'dg-chip dg-chip--waiting'],
  later: ['Not sent yet', 'dg-chip dg-chip--later'],
  decided: [null, 'dg-chip dg-chip--decided'],
};

export default class SeniorGuide extends Component {
  @service lianaServerFetch;

  @service store;

  @service('feature/workflow') workflowFeature;

  @tracked taken = false;

  @tracked reviewing = false;

  @tracked facts = null;

  @tracked failed = false;

  constructor(owner, args) {
    super(owner, args);
    this.timer = window.setInterval(() => this.refresh(), POLL_MS);
    this.refresh();
  }

  willDestroy(...args) {
    super.willDestroy?.(...args);
    window.clearInterval(this.timer);
  }

  async refresh() {
    this.readDesk();

    try {
      const response = await this.lianaServerFetch.fetch(
        '/forest/_charts/demo_guide?desk=senior',
        {},
      );
      if (!response.ok) throw new Error(`agent answered ${response.status}`);
      this.facts = await response.json();
      this.failed = false;
    } catch (error) {
      this.failed = true;
    }
  }

  /** The case taken from the inbox, and Senior review running on it. */
  async readDesk() {
    const inbox = this.args.component?.getWorkspaceComponentFromName?.(
      this.params.get('inbox') || 'SeniorInbox',
    );
    const record = inbox?.selectedRecord || null;
    this.taken = Boolean(record);

    if (!record) {
      this.reviewing = false;

      return;
    }

    try {
      const collection = listOf(this.store.peekAll('collection')).find(c => c.name === 'kyc_cases');
      const workflow = listOf(collection?.workflows).find(w => w.name === WORKFLOW);
      const runs = await this.workflowFeature.getStartedWorkflowRunsForRecord(
        collection.id,
        record.id,
      );
      this.reviewing = listOf(runs).some(r => String(r.workflowId) === String(workflow?.id));
    } catch (error) {
      this.reviewing = false;
    }
  }

  get params() {
    const url = this.args.component?.options?.componentUrl || '';

    return new URLSearchParams(url.split('?')[1] || '');
  }

  /** The how-to, each step done or not, the first open one marked as the current one. */
  get how() {
    const decided = Boolean(this.facts?.decided);
    const steps = [...HOW, NEXT_TICKET_STEP];
    const done = [this.taken || decided, this.reviewing || decided, (this.facts?.decided || 0) > 1];
    const current = done.indexOf(false);

    return steps.map((step, i) => {
      let state = 'todo';
      if (done[i]) state = 'done';
      else if (i === current) state = 'current';

      return {
        ...step,
        className: `dg-step dg-step--${state}`,
        mark: done[i] ? '\u2713' : String(i + 1),
      };
    });
  }

  get cases() {
    return (this.facts?.cases || []).map(c => {
      const [label, className] = STATES[c.state] || STATES.later;

      return {
        ...c,
        chip: label || c.outcome,
        chipClass: className,
        rowClass: `dg-case dg-case--${c.state}`,
        later:
          c.state === 'later'
            ? 'Do case 2 on the KYC Case desk: its workflow sends it here.'
            : null,
      };
    });
  }

  get progress() {
    if (!this.facts) return null;
    const total = this.facts.cases?.length || 0;

    return `${this.facts.decided} of ${total} decided`;
  }

  get end() {
    if (!this.facts?.decided) return null;

    return {
      title: 'That’s four eyes on a medium risk!',
      text:
        'You’ve seen the whole path, from the first check to the senior’s sign-off. Back to ' +
        'the Hub to explore the other desks.',
    };
  }

  /** The base text size, from the box: the whole guide fits its height and its width. */
  get rootStyle() {
    const box = this.args.component?.displaySettings;
    if (!box?.width || !box?.height) return null;
    const size = Math.min((box.height * CELL) / EM_TALL, (box.width * CELL) / EM_WIDE);

    return htmlSafe(`font-size:${Math.round(Math.max(11, Math.min(30, size)))}px`);
  }
}
