/**
 * The facts behind the KYC Case desk's guide (select-first/demo-guide.*): for one case, which of
 * the demo's steps are done, read from the case itself, never from clicks. API chart
 * `GET /forest/_charts/demo_guide?id=<kyc case id>`, read every few seconds by the guide.
 *
 * - documents / screening: the history line "Check documents" and "Screen against sanctions lists"
 *   write (case-file.js, checksRun);
 * - idChecked: the case's ID has a check result (Verify document);
 * - riskAfter: the rating "Rate the risk" wrote;
 * - escalated: the case went to a senior (PENDING_APPROVAL now or in its history);
 * - status: APPROVED or REJECTED at the end.
 *
 * With `?desk=senior` (the senior officer's guide): the senior's demo cases (KYC-DEMO-0002 once
 * sent, -0003, -0004), each waiting or decided, and how many are decided.
 *
 * Each `desk` answer carries `unlocked`, for the Go to buttons that wait on the visitor
 * (select-first/go-to.js `unlock=`): `senior` once a case is decided, `simplified` once the
 * visitor ran a Smart Action (any history line signed with their email).
 *
 * `?desk=auto` (the automatic desk's guide): the visitor's last "Send new applications" batch
 * (demo-feed.js), each case sent, with the robot, approved, handed to a person or reviewed;
 * `unlocked` once the visitor decided a file the robot handed over..
 */
const { lastBatch } = require('../customizations/actions/demo-feed');

const ID_TYPES = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'];

const where = (field, operator, value) => ({ field, operator, value });
const and = (...conditions) => ({ conditionTree: { aggregator: 'And', conditions } });

async function demoGuideFacts(dataSource, id) {
  if (!id) return { found: false };
  const list = (table, filter, fields) => dataSource.getCollection(table).list(filter, fields);
  const [kyc] = await list('kyc_cases', { conditionTree: where('id', 'Equal', id) }, [
    'id',
    'reference',
    'status',
    'risk_after',
  ]);
  if (!kyc) return { found: false };
  const [lines, ids] = await Promise.all([
    list(
      'status_changes',
      and(where('record_type', 'Equal', 'KYC_CASES'), where('record_id', 'Equal', id)),
      ['field', 'new_value'],
    ),
    list(
      'documents',
      and(where('kyc_case_id', 'Equal', id), where('document_type', 'In', ID_TYPES)),
      ['check_result'],
    ),
  ]);
  const has = field => lines.some(l => l.field === field);

  return {
    found: true,
    reference: kyc.reference,
    status: kyc.status,
    riskAfter: kyc.risk_after || null,
    documents: has('documents'),
    idChecked: ids.length > 0 && ids.every(d => Boolean(d.check_result)),
    screening: has('screening'),
    escalated:
      kyc.status === 'PENDING_APPROVAL' ||
      lines.some(l => l.field === 'status' && l.new_value === 'PENDING_APPROVAL'),
  };
}

// The senior's demo cases, in queue order, and what each one shows (showcase.js).
const SENIOR_QUEUE = ['KYC-DEMO-0003', 'KYC-DEMO-0004', 'KYC-DEMO-0002'];
const STORIES = {
  'KYC-DEMO-0002': 'Sent from the KYC Case desk: more money expected in than the income',
  'KYC-DEMO-0003': 'More money expected in than the declared income',
  'KYC-DEMO-0004': 'Funds from an inheritance, no notary deed on file',
};
const OUTCOMES = {
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  WAITING_CUSTOMER: 'Proof of funds asked',
};

/** The senior officer's queue: each demo case waiting, decided or not sent yet. */
async function seniorQueueFacts(dataSource) {
  const list = (table, filter, fields) => dataSource.getCollection(table).list(filter, fields);
  const cases = await list('kyc_cases', { conditionTree: where('reference', 'In', SENIOR_QUEUE) }, [
    'id',
    'reference',
    'status',
    'risk_after',
    'customer:display_name',
  ]);
  const lines = cases.length
    ? await list(
        'status_changes',
        and(
          where('record_type', 'Equal', 'KYC_CASES'),
          where(
            'record_id',
            'In',
            cases.map(c => c.id),
          ),
          where('field', 'Equal', 'status'),
          where('new_value', 'Equal', 'PENDING_APPROVAL'),
        ),
        ['record_id'],
      )
    : [];
  const sent = new Set(lines.map(l => l.record_id));
  const rows = SENIOR_QUEUE.map(reference => {
    const kyc = cases.find(c => c.reference === reference);
    if (!kyc) return null;
    const escalated = kyc.status === 'PENDING_APPROVAL' || sent.has(kyc.id);
    let state = 'later';
    if (kyc.status === 'PENDING_APPROVAL') state = 'waiting';
    else if (escalated && OUTCOMES[kyc.status]) state = 'decided';

    return {
      reference,
      name: kyc.customer?.display_name || null,
      story: STORIES[reference],
      risk: kyc.risk_after || null,
      state,
      outcome: state === 'decided' ? OUTCOMES[kyc.status] : null,
    };
  }).filter(Boolean);

  const decided = rows.filter(r => r.state === 'decided').length;

  return { cases: rows, decided, unlocked: decided > 0 };
}

/** Has the visitor run a Smart Action? Every action writes a history line in their name. */
async function simplifiedFacts(dataSource, caller) {
  if (!caller?.email) return { unlocked: false };
  const lines = await dataSource
    .getCollection('status_changes')
    .list(
      { conditionTree: where('changed_by', 'Equal', caller.email), page: { skip: 0, limit: 1 } },
      ['id'],
    );

  return { unlocked: lines.length > 0 };
}

// ---- the automatic desk ----------------------------------------------------------------------

const HANDOVER = 'Handed to a person: ';
const DECIDED = ['APPROVED', 'REJECTED', 'WAITING_CUSTOMER'];

/** Each case of a batch where it stands: sent, robot, approved, person (to review), reviewed. */
function batchState(kyc, handover, reviewedAt) {
  if (kyc.risk_before !== 'LOW') {
    // A pre-score MEDIUM is never automated: the operators' queue takes it.
    return DECIDED.includes(kyc.status) ? 'reviewed' : 'person';
  }

  if (handover) return reviewedAt ? 'reviewed' : 'person';
  if (kyc.status === 'APPROVED') return 'approved';
  if (kyc.status === 'OPEN') return 'sent';

  return 'robot';
}

async function autoFacts(dataSource, caller) {
  const list = (table, filter, fields) => dataSource.getCollection(table).list(filter, fields);
  const me = caller?.email || null;
  // Files the robot handed over that this visitor then moved (unlocks the next steps).
  const handovers = await list(
    'status_changes',
    and(
      where('record_type', 'Equal', 'KYC_CASES'),
      where('field', 'Equal', 'assigned_to'),
      where('reason', 'StartsWith', HANDOVER),
    ),
    ['record_id', 'changed_at'],
  );
  const handedAt = new Map(handovers.map(h => [h.record_id, h.changed_at]));
  const mine =
    me && handedAt.size
      ? await list(
          'status_changes',
          and(
            where('record_type', 'Equal', 'KYC_CASES'),
            where('field', 'Equal', 'status'),
            where('changed_by', 'Equal', me),
            where('record_id', 'In', [...handedAt.keys()]),
          ),
          ['record_id', 'changed_at'],
        )
      : [];
  const reviewedAt = new Map(
    mine
      .filter(l => new Date(l.changed_at) >= new Date(handedAt.get(l.record_id)))
      .map(l => [l.record_id, l.changed_at]),
  );
  const batch = me ? lastBatch(me) : null;
  const ids = batch ? batch.cases.map(c => c.kycId) : [];
  const rows = ids.length
    ? await list('kyc_cases', { conditionTree: where('id', 'In', ids) }, [
        'id',
        'reference',
        'status',
        'risk_before',
        'customer:display_name',
      ])
    : [];
  const cases = ids
    .map(id => rows.find(r => r.id === id))
    .filter(Boolean)
    .map(k => ({
      reference: k.reference,
      name: k.customer?.display_name || null,
      state: batchState(k, handedAt.has(k.id), reviewedAt.get(k.id)),
    }));
  const count = state => cases.filter(c => c.state === state).length;

  return {
    sentAt: batch?.at || null,
    cases,
    robotDone: cases.length > 0 && !cases.some(c => ['sent', 'robot'].includes(c.state)),
    approved: count('approved'),
    toPerson: count('person'),
    reviewed: reviewedAt.size,
    unlocked: reviewedAt.size > 0,
  };
}

function chartFacts({ dataSource, parameters, caller }) {
  if (parameters?.desk === 'senior') return seniorQueueFacts(dataSource);
  if (parameters?.desk === 'simplified') return simplifiedFacts(dataSource, caller);
  if (parameters?.desk === 'auto') return autoFacts(dataSource, caller);

  return demoGuideFacts(dataSource, parameters?.id);
}

function addDemoGuideChart(customizer) {
  customizer.addChart('demo_guide', async (context, resultBuilder) =>
    resultBuilder.smart(await chartFacts(context)),
  );
}

module.exports = {
  SENIOR_QUEUE,
  addDemoGuideChart,
  autoFacts,
  demoGuideFacts,
  seniorQueueFacts,
  simplifiedFacts,
};
