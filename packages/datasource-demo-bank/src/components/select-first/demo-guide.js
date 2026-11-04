/* eslint-disable import/no-unresolved -- runs inside the Forest app, which provides these */
/* eslint-env browser */
/**
 * Demo guide: a workspace Custom component for the KYC Case desk. It follows the case picked in
 * the desk's list (`?list=`, default List_Untreated) and walks the visitor through that demo case:
 *
 * - KYC-DEMO-0001: each Smart Action run by hand, up to "Approve KYC - Low risk", then a pointer to
 *   case 2;
 * - KYC-DEMO-0002: the same steps bundled in the Retail onboarding workflow, the MEDIUM rating, the
 *   escalation to a senior, then a pointer to the senior officer's desk.
 *
 * A step ticks itself when the case shows it done (the agent's API chart demo_guide reads the
 * case's history, papers, rating and status), read again every POLL_MS. The text's size follows
 * the component's box. Generated as hub/demo-guide.{hbs,js,css}.
 *
 * Actions a workflow runs do not tell the workspace (only a Smart Action button does): its fields
 * and lists keep the case as it was fetched. When the case's facts change between two reads, the
 * guide asks Forest to refresh, as after a button: the lists of kyc_cases reload (statuses, the
 * desk buttons' locks) and the picked case is fetched again (the fields).
 *
 * In case 2, the step to do carries a button that starts the workflow (`?workflow=`, default Retail
 * onboarding) on the case, or reopens its run, as Forest's own workflow button does.
 */
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const POLL_MS = 2000;
// Forest's grid cell, in px (WORKSPACE_GRID_CELL_WIDTH and _HEIGHT).
const CELL = 20;
// The guide's content is about this many lines of its base size tall, and this many wide.
const EM_TALL = 42;
const EM_WIDE = 34;

const SENIOR = ['MEDIUM', 'HIGH'];
const DEFAULT_WORKFLOW = 'Retail onboarding';
const START = '▶ Start Retail onboarding';
const REOPEN = '▶ Reopen the workflow';

const CASES = {
  'KYC-DEMO-0001': {
    badge: 'Case 1',
    title: 'The happy path, one action at a time',
    intro:
      'Run each Smart Action yourself, in order, with the buttons on the left. Each box ticks itself as soon as the case shows the step done.',
    steps: [
      {
        title: 'Take the case',
        detail: '"Take first case" selects it: its file fills the sections on the left.',
        done: () => true,
      },
      {
        title: 'Check documents',
        detail: 'Section 1: every paper here and valid, the proof of address under 3 months.',
        done: f => f.documents,
      },
      {
        title: 'Verify document',
        detail: 'Section 2: Onfido reads the ID and matches the selfie to it.',
        done: f => f.idChecked,
      },
      {
        title: 'Screen against sanctions lists',
        detail: 'Section 3: nobody on a sanctions or PEP list.',
        done: f => f.screening,
      },
      {
        title: 'Rate the risk',
        detail: 'Section 4: the suggested rating is LOW. Keep it.',
        done: f => Boolean(f.riskAfter),
        warn: f =>
          f.riskAfter && f.riskAfter !== 'LOW'
            ? `Rated ${f.riskAfter}: case 1 is a low risk. Run "Rate the risk" again with LOW.`
            : null,
      },
      {
        title: 'Approve KYC - Low risk',
        detail: 'Section 5: the customer becomes active, with a current account and its IBAN.',
        done: f => f.status === 'APPROVED',
      },
    ],
    end: f =>
      f.status === 'APPROVED'
        ? {
            title: 'Case 1 approved!',
            text: 'Now let’s move on to case 2: click "Take second case" in the section above.',
          }
        : null,
  },
  'KYC-DEMO-0002': {
    badge: 'Case 2',
    title: 'A workflow, and an escalation',
    intro:
      'This time the steps come bundled in a workflow: start ▶ Retail onboarding and follow its panel. It runs the same actions in order, then decides who approves.',
    steps: [
      {
        title: 'Take the case',
        detail: '"Take second case" selects it.',
        done: () => true,
      },
      {
        title: 'Start ▶ Retail onboarding',
        detail: 'Its first steps read the file and run Check documents.',
        done: f => f.documents,
        button: START,
      },
      {
        title: 'Verify the ID',
        detail: 'The workflow asks for Verify document: Onfido checks the ID and the selfie.',
        done: f => f.idChecked,
        button: REOPEN,
      },
      {
        title: 'Screen the applicant',
        detail: 'Screen against sanctions lists: nobody found.',
        done: f => f.screening,
        button: REOPEN,
      },
      {
        title: 'Rate the risk: MEDIUM',
        detail: 'More money expected in than the declared income. Keep MEDIUM.',
        done: f => SENIOR.includes(f.riskAfter),
        button: REOPEN,
        warn: f =>
          f.riskAfter === 'LOW'
            ? 'Rated LOW: case 2 is meant to be MEDIUM. Run "Rate the risk" again with MEDIUM.'
            : null,
      },
      {
        title: 'Sent to a senior',
        detail:
          'Not low: the workflow’s last step, Send for senior sign-off, puts it in the senior officer’s queue.',
        done: f => f.escalated,
        button: REOPEN,
      },
      {
        title: 'A senior approves it',
        detail:
          'On the senior officer’s desk: Start processing, then ▶ Senior review; the senior decides.',
        done: f => f.status === 'APPROVED',
      },
    ],
    end: f => {
      if (f.status === 'APPROVED') {
        return { title: 'Approved with four eyes!', text: 'That’s the whole loop: well done.' };
      }

      if (f.escalated) {
        return {
          title: 'It’s in the senior officer’s inbox',
          text: 'Click "Go to the senior officer’s desk" below and pick it up there.',
        };
      }

      return null;
    },
  },
};

const fieldOf = (row, name) =>
  row?.[`forest-${name}`] ?? row?.getAttributesSerialized?.()[name] ?? row?.[name];

export default class DemoGuide extends Component {
  @service lianaServerFetch;

  @service store;

  @service('feature/workflow') workflowFeature;

  @service('beta-collection-list-communicator') listCommunicator;

  @tracked starting = false;

  @tracked workflowNote = null;

  @tracked facts = null;

  @tracked failed = false;

  // Bumped by the timer so the selection is read again (the list may change it at any time).
  @tracked tick = 0;

  constructor(owner, args) {
    super(owner, args);
    this.timer = window.setInterval(() => {
      this.tick += 1;
      this.refresh();
    }, POLL_MS);
    this.refresh();
  }

  willDestroy(...args) {
    super.willDestroy?.(...args);
    window.clearInterval(this.timer);
  }

  get params() {
    const url = this.args.component?.options?.componentUrl || '';

    return new URLSearchParams(url.split('?')[1] || '');
  }

  get selected() {
    // eslint-disable-next-line no-unused-expressions, @typescript-eslint/no-unused-expressions -- read to follow the selection on each poll
    this.tick;
    const list = this.args.component?.getWorkspaceComponentFromName?.(
      this.params.get('list') || 'List_Untreated',
    );

    return list?.selectedRecord || null;
  }

  get reference() {
    return fieldOf(this.selected, 'reference') || null;
  }

  get guide() {
    return CASES[this.reference] || null;
  }

  async refresh() {
    const id = this.selected?.id;

    if (!id || !this.guide) {
      this.facts = null;

      return;
    }

    try {
      const response = await this.lianaServerFetch.fetch(
        `/forest/_charts/demo_guide?id=${encodeURIComponent(id)}`,
        {},
      );
      if (!response.ok) throw new Error(`agent answered ${response.status}`);
      const facts = await response.json();
      // A late answer for a case no longer picked is dropped.
      if (this.selected?.id !== id) return;
      this.facts = facts;
      const print = JSON.stringify(facts);
      if (this.seen?.id === id && this.seen.print !== print) this.refreshWorkspace();
      this.seen = { id, print };
      this.failed = false;
    } catch (error) {
      this.failed = true;
    }
  }

  /** Lists of kyc_cases reloaded, the picked case fetched again: as after a Smart Action button. */
  refreshWorkspace() {
    try {
      const listOf = rows => (rows?.toArray ? rows.toArray() : Array.from(rows || []));
      const collection = listOf(this.store.peekAll('collection')).find(c => c.name === 'kyc_cases');
      if (!collection) return;
      this.listCommunicator.refreshAll(collection);
      this.listCommunicator.smartActionTriggered({ collection });
    } catch (error) {
      console.warn('demo-guide: the workspace could not be refreshed', error);
    }
  }

  /** The case's steps, each done or not, the first open one marked as the current one. */
  get steps() {
    const { guide, facts } = this;
    if (!guide) return [];
    const ready = facts?.found && facts.reference === this.reference;
    const states = guide.steps.map(step => ready && Boolean(step.done(facts)));
    const current = states.indexOf(false);

    return guide.steps.map((step, i) => {
      let state = 'todo';
      if (states[i]) state = 'done';
      else if (i === current) state = 'current';

      return {
        number: i + 1,
        title: step.title,
        detail: step.detail,
        warn: ready && step.warn ? step.warn(facts) : null,
        className: `dg-step dg-step--${state}`,
        mark: states[i] ? '✓' : String(i + 1),
        // The workflow's button, on the step to do only.
        button: state === 'current' && step.button ? step.button : null,
      };
    });
  }

  get startLabel() {
    return this.starting ? 'Opening the workflow…' : null;
  }

  /**
   * Start the workflow on the picked case, or reopen its run, as Forest's workflow button does:
   * the record's started runs, the one of this workflow, then the workflow service.
   */
  @action
  async startWorkflow() {
    const record = this.selected;
    if (!record || this.starting) return;
    const name = this.params.get('workflow') || DEFAULT_WORKFLOW;
    const listOf = rows => (rows?.toArray ? rows.toArray() : Array.from(rows || []));
    const collection = listOf(this.store.peekAll('collection')).find(c => c.name === 'kyc_cases');
    const workflow = listOf(collection?.workflows).find(w => w.name === name);

    if (!workflow) {
      this.workflowNote = `No workflow "${name}" on KYC cases: use the workflow button instead.`;

      return;
    }

    this.workflowNote = null;
    this.starting = true;

    try {
      const runs = await this.workflowFeature.getStartedWorkflowRunsForRecord(
        collection.id,
        record.id,
      );
      const run = listOf(runs).find(r => String(r.workflowId) === String(workflow.id));
      await this.workflowFeature.startWorkflow(workflow, record, run);
    } catch (error) {
      this.workflowNote = 'The workflow did not open: use the workflow button instead.';
      console.warn('demo-guide: the workflow did not start', error);
    } finally {
      this.starting = false;
    }
  }

  get end() {
    const { guide, facts } = this;

    return guide && facts?.found ? guide.end(facts) : null;
  }

  get empty() {
    if (this.reference && !this.guide) {
      return `${this.reference} is not a demo case: this guide follows KYC-DEMO-0001 and KYC-DEMO-0002.`;
    }

    return 'Click "Take first case" above to start: this guide walks you through it, step by step.';
  }

  /** The base text size, from the box: the whole guide fits its height and its width. */
  get rootStyle() {
    const box = this.args.component?.displaySettings;
    if (!box?.width || !box?.height) return null;
    const size = Math.min((box.height * CELL) / EM_TALL, (box.width * CELL) / EM_WIDE);

    return htmlSafe(`font-size:${Math.round(Math.max(11, Math.min(30, size)))}px`);
  }
}
