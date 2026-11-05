/**
 * The API chart `demo_guide`: how far the demo's KYC story has gone, read from the records
 * themselves (history lines, documents, statuses), never from clicks.
 *
 * `GET /forest/_charts/demo_guide?id=<kyc case id>`, for one case:
 * - documents / screening: the history line "Check documents" and "Screen against sanctions lists"
 *   write (case-file.ts, checksRun);
 * - idChecked: the case's ID has a check result (Verify document);
 * - riskAfter: the rating "Rate the risk" wrote;
 * - escalated: the case went to a senior (PENDING_APPROVAL now or in its history);
 * - status: APPROVED or REJECTED at the end.
 *
 * `?desk=senior`: the senior officer's demo cases (KYC-DEMO-0002 once sent, -0003, -0004), each
 * waiting, decided or not sent yet, how many are decided, and `unlocked` once one is.
 * `?desk=simplified`: `unlocked` once the caller ran a Smart Action (any history line signed with
 * their email).
 */
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

// The senior's demo cases, in queue order, and what each one shows (showcase.ts).
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

function chartFacts({ dataSource, parameters, caller }) {
  if (parameters?.desk === 'senior') return seniorQueueFacts(dataSource);
  if (parameters?.desk === 'simplified') return simplifiedFacts(dataSource, caller);

  return demoGuideFacts(dataSource, parameters?.id);
}

function addDemoGuideChart(customizer) {
  customizer.addChart('demo_guide', async (context, resultBuilder) =>
    resultBuilder.smart(await chartFacts(context)),
  );
}

// eslint-disable-next-line import/prefer-default-export
export { addDemoGuideChart };
