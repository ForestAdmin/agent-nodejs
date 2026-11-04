/**
 * What the onboarding robot did with each application it was given (the automated inbox runs
 * "Retail onboarding: automatic", a workflow of the demo layout): approved it, or handed it to a
 * person, when, and why. The Onboarding desks list these in "Cases treated automatically".
 *
 * The robot is given a new retail application the app pre-scored LOW (risk_before; seeded cases
 * leave it empty). Its "Hand to a person" step writes a status_changes row (field assigned_to, its
 * reason the checks that failed, actions-onboarding.js); an application approved without one was
 * approved by the robot. The agent reseeds its database when it starts, so every hand-over it
 * holds has its row.
 */
import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import { reader } from '../shared/case-file';

const HANDOVER = 'Handed to a person: ';
// Short: they are read in a list column.
const OUTCOMES = {
  waiting: '⏳ Waiting',
  checking: '⚙ Checking',
  approved: '✓ Approved',
  handed: '👤 To a person',
};
const LABELS = {
  robot_outcome: 'Robot · Outcome',
  robot_decided_at: 'Robot · Decided at',
  robot_why: 'Robot · Why it went to a person',
};
const FIELDS = Object.keys(LABELS);

const givenToRobot = kyc => kyc.type === 'ONBOARDING' && kyc.risk_before === 'LOW';

/** The hand-over row's reason, as the status history keeps it (255 characters at most). */
function handoverReason(reasons) {
  const text = `${HANDOVER}${reasons.join('; ') || 'see the file'}`;

  return text.length > 255 ? `${text.slice(0, 254)}…` : text;
}

/** The robot's result on one case, from its hand-over row (or none) and the case itself. */
function robotResult(kyc, handover) {
  if (!givenToRobot(kyc)) return null;

  if (handover) {
    return {
      robot_outcome: OUTCOMES.handed,
      robot_decided_at: handover.changed_at,
      robot_why: handover.reason.slice(HANDOVER.length),
    };
  }

  if (kyc.status === 'OPEN') return { robot_outcome: OUTCOMES.waiting };

  if (kyc.status === 'APPROVED') {
    return { robot_outcome: OUTCOMES.approved, robot_decided_at: kyc.resolved_at };
  }

  // Started, not decided yet: a run takes seconds.
  return { robot_outcome: OUTCOMES.checking };
}

async function results(records, context) {
  const list = reader(context.dataSource);
  const given = records.filter(givenToRobot);
  const rows = given.length
    ? await list(
        'status_changes',
        [
          new ConditionTreeLeaf('record_type', 'Equal', 'KYC_CASES'),
          new ConditionTreeLeaf('field', 'Equal', 'assigned_to'),
          new ConditionTreeLeaf('reason', 'StartsWith', HANDOVER),
          new ConditionTreeLeaf(
            'record_id',
            'In',
            given.map(r => r.id),
          ),
        ],
        ['record_id', 'changed_at', 'reason'],
        { field: 'changed_at', ascending: true },
      )
    : [];

  return records.map(kyc =>
    robotResult(
      kyc,
      rows.find(r => r.record_id === kyc.id),
    ),
  );
}

function addRobotResults(collection) {
  const cache = new WeakMap();

  const resultsOf = (records, context) => {
    if (!cache.has(records)) cache.set(records, results(records, context));

    return cache.get(records);
  };

  FIELDS.forEach(name =>
    collection.addField(name, {
      columnType: name === 'robot_decided_at' ? 'Date' : 'String',
      dependencies: [
        'id',
        'customer_id',
        'type',
        'channel',
        'status',
        'risk_before',
        'resolved_at',
      ],
      getValues: async (records, context) =>
        (await resultsOf(records, context)).map(r => r?.[name] ?? null),
    }),
  );
}

export { FIELDS, LABELS, OUTCOMES, addRobotResults, handoverReason, robotResult };
