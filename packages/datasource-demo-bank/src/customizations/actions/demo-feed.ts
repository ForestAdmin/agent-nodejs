/**
 * "Send new applications", a Global Smart Action on kyc_cases, a demo tool. It sends N retail
 * applications as the app does (live.ts newRetailApplicant):
 *
 * - a clean file: nothing to flag in the profile (case-file.ts applicantRating LOW, no income
 *   proof needed), an ID whose scan is clean (random.ts scanFlaw), pre-score LOW. It waits in the
 *   queue "Retail onboarding: automatic" (kyc_retail_auto), every check ready to pass.
 * - an ID the provider cannot pass (scan cut off, or a name that differs), pre-score LOW: in the
 *   same queue, but the ID check does not come back clean, so a person decides.
 * - a pre-score MEDIUM (more money expected in than the declared income): in the "Retail
 *   onboarding" queue, for an operator.
 *
 * The pre-score is the case's risk_before, written by the app when the application arrives
 * (seeded onboarding cases leave it empty, so the automatic queue never holds the backlog).
 */
import { randomUUID } from 'crypto';

import { forestStore, newRetailApplicant, newRun } from '../../seed/live';
import { scanFlaw } from '../../seed/random';
import { MONTHLY_NET } from '../../seed/reference';
import { applicantRating } from '../shared/case-file';
import { badge, card } from '../shared/render';

const ACTION = 'Send new applications';
const HOW_MANY = 'How many';
const SHARE = 'Share needing review (%)';
const MAX = 10;

// Above 70k EUR a year the bank asks for an income proof the app does not send: not clean.
const PROOF_BANDS = ['FROM_70K_TO_120K', 'ABOVE_120K'];
// The top of each declared band, a year (case-file.ts BANDS).
const BAND_TOP = { BELOW_20K: 20000, FROM_20K_TO_40K: 40000, FROM_40K_TO_70K: 70000 };

const MINUTE = 60 * 1000;
const roundTo = (n, step) => Math.round(n / step) * step;

/** A clean profile: the money expected in stays under what the person earns (95% at most). */
const cleanIn = p => roundTo(MONTHLY_NET[p.income_band] * (0.75 + Math.random() * 0.2), 10);
const cleanProfile = p =>
  !PROOF_BANDS.includes(p.income_band) &&
  applicantRating([p], { expected_monthly_in: MONTHLY_NET[p.income_band] * 0.95 }) === 'LOW';
// Every demo application comes from the bank's app (the result card says so).
const FROM_APP = { channel: 'APP' };

/** An id whose scan shows `flaw` (random.ts scanFlaw), as crime.ts and actions/partner.ts do. */
function idWithFlaw(flaw) {
  let id = randomUUID();
  while (scanFlaw(id) !== flaw) id = randomUUID();

  return id;
}

/** The ways an application is sent, and where each one ends up. */
const KINDS = {
  clean: {
    shape: () => ({
      accept: cleanProfile,
      monthlyIn: cleanIn,
      risk: 'LOW',
      intake: 'LOW',
      idDocumentId: idWithFlaw('clean'),
      ...FROM_APP,
    }),
    shows: 'Clean: ID and selfie match, income fits, nothing to flag',
    goes: 'Retail onboarding: automatic (should be approved)',
    tone: 'green',
  },
  cropped: {
    shape: () => ({
      accept: cleanProfile,
      monthlyIn: cleanIn,
      risk: 'LOW',
      intake: 'LOW',
      idDocumentId: idWithFlaw('cropped'),
      ...FROM_APP,
    }),
    shows: 'ID scan cut off at one edge',
    goes: 'Retail onboarding: automatic, then a person (ID check fails)',
    tone: 'amber',
  },
  name: {
    shape: () => ({
      accept: cleanProfile,
      monthlyIn: cleanIn,
      risk: 'LOW',
      intake: 'LOW',
      idDocumentId: idWithFlaw('name'),
      ...FROM_APP,
    }),
    shows: 'Name on the ID differs from the application',
    goes: 'Retail onboarding: automatic, then a person (ID check fails)',
    tone: 'red',
  },
  medium: {
    shape: () => ({
      accept: p => Boolean(BAND_TOP[p.income_band]),
      monthlyIn: p => roundTo((BAND_TOP[p.income_band] / 12) * (1.5 + Math.random() * 0.3), 50),
      risk: 'MEDIUM',
      intake: 'MEDIUM',
      idDocumentId: idWithFlaw('clean'),
      ...FROM_APP,
    }),
    shows: 'Pre-score MEDIUM: more money expected in than the declared income',
    goes: 'Retail onboarding (an operator reviews it)',
    tone: 'amber',
  },
};
// The files needing a person, in turn: two the ID check stops (an ID cut off, then a name that
// differs), then one the automatic queue never takes (pre-score MEDIUM).
const REVIEW_TURN = ['cropped', 'name', 'medium'];

/** n applications, `review` of them needing a person, spread among the clean ones. */
function plan(n, review) {
  const kinds = Array.from({ length: n }, () => 'clean');

  for (let i = 0; i < review; i += 1) {
    kinds[Math.min(n - 1, Math.floor(((i + 0.5) * n) / review))] =
      REVIEW_TURN[i % REVIEW_TURN.length];
  }

  return kinds;
}

/** What the form asks, within bounds: 1 to 10 applications, 0 to 100% needing review. */
function asked(formValues) {
  const n = Math.max(1, Math.min(MAX, Math.round(Number(formValues[HOW_MANY]) || 5)));
  const share = Number(formValues[SHARE]);
  const pct = Math.max(0, Math.min(100, Number.isFinite(share) ? share : 40));

  return { n, review: Math.round((n * pct) / 100) };
}

/** The same run, its clock moved back: applications sent a minute or two apart, not in a burst. */
function earlier(run, store, minutes) {
  const now = new Date(run.now.getTime() - minutes * MINUTE);

  return { ...run, now, at: ago => store.stamp(new Date(now.getTime() - ago * MINUTE)) };
}

/** Send the applications, one after the other (each takes the next case reference). */
async function sendApplications(store, n, review) {
  const run = newRun(store);
  const kinds = plan(n, review);
  // The last one arrives now, the ones before 1 to 3 minutes apart.
  const gaps = kinds.map(() => 1 + Math.random() * 2);

  return kinds.reduce(
    (done, kind, i) =>
      done.then(async sent => {
        const back = gaps.slice(i + 1).reduce((sum, gap) => sum + gap, 0);
        const created = await newRetailApplicant(earlier(run, store, back), KINDS[kind].shape());

        return [...sent, { kind, ...created }];
      }),
    Promise.resolve([]),
  );
}

function resultCard(sent) {
  const clean = sent.filter(s => s.kind === 'clean').length;

  return card({
    eyebrow: 'Demo · new retail applications',
    title: `${sent.length} application${sent.length > 1 ? 's' : ''} sent from the app`,
    status: [
      `${clean} should be approved automatically · ${sent.length - clean} for a person`,
      'green',
    ],
    list: {
      head: ['Case', 'Applicant', 'What the file shows', 'Goes to'],
      rows: sent.map(s => [
        s.reference,
        s.name,
        { html: badge(KINDS[s.kind].shows, KINDS[s.kind].tone) },
        KINDS[s.kind].goes,
      ]),
    },
    note:
      'Every application pre-scored LOW waits in the queue "Retail onboarding: automatic": a ' +
      'clean one passes every check and can be approved without a person; one whose ID check ' +
      'fails needs a person. A pre-score MEDIUM waits in "Retail onboarding", for an operator.',
  });
}

function addDemoFeed(collection) {
  collection.addAction(ACTION, {
    scope: 'Global',
    form: [
      {
        label: HOW_MANY,
        type: 'Number',
        defaultValue: 5,
        isRequired: true,
        description: `New retail applications, at most ${MAX}.`,
      },
      {
        label: SHARE,
        type: 'Number',
        defaultValue: 40,
        isRequired: true,
        description: 'An ID the provider cannot pass, or a pre-score MEDIUM: a person decides.',
      },
    ],
    execute: async (context, resultBuilder) => {
      const { n, review } = asked(context.formValues);
      const sent = await sendApplications(forestStore(context.dataSource), n, review);

      return resultBuilder.success(
        `${sent.length} new application${sent.length > 1 ? 's' : ''} sent.`,
        { html: resultCard(sent) },
      );
    },
  });
}

export { KINDS, addDemoFeed, asked, plan };
