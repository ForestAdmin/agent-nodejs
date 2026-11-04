import { customizeDocuments as addDocumentActions } from './actions/onboarding';
import * as render from './shared/render';
import { uploaded } from './shared/uploads';

/** Approved address changes of the people on these documents, oldest first. */
async function movesAfter(records, context) {
  const people = [...new Set(records.map(r => r.individual_id).filter(Boolean))];
  const moves = new Map();
  if (!people.length) return moves;
  const changes = await context.dataSource.getCollection('customer_change_requests').list(
    {
      conditionTree: {
        aggregator: 'And',
        conditions: [
          { field: 'individual_id', operator: 'In', value: people },
          { field: 'field', operator: 'Equal', value: 'ADDRESS' },
          { field: 'status', operator: 'Equal', value: 'APPROVED' },
        ],
      },
      sort: [{ field: 'decided_at', ascending: true }],
    },
    ['individual_id', 'old_value', 'decided_at'],
  );
  changes.forEach(c => moves.set(c.individual_id, [...(moves.get(c.individual_id) || []), c]));

  return moves;
}

/** The document itself, as a PDF; a company's owners declaration lists its owners above 25%. */
async function drawDocuments(records, context) {
  const companies = [
    ...new Set(records.filter(r => r.document_type === 'UBO_DECLARATION').map(r => r.business_id)),
  ];
  const owners = new Map();

  if (companies.length) {
    const members = await context.dataSource.getCollection('business_members').list(
      {
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'business_id', operator: 'In', value: companies },
            { field: 'ownership_pct', operator: 'GreaterThan', value: 25 },
          ],
        },
      },
      ['business_id', 'ownership_pct', 'individual:first_name', 'individual:last_name'],
    );
    members.forEach(m => {
      const name = `${m.individual?.first_name || ''} ${m.individual?.last_name || ''}`.trim();
      if (!name) return;
      owners.set(m.business_id, [
        ...(owners.get(m.business_id) || []),
        [name, `${m.ownership_pct}%`],
      ]);
    });
  }

  const moves = await movesAfter(records, context);

  // A paper a partner sent (actions/partner.ts) is its own file; the others are drawn.
  return records.map(
    r =>
      uploaded(r.id)?.uri ||
      render.pdfUri(
        render.addressAtUpload(r, moves.get(r.individual_id)),
        owners.get(r.business_id) || [],
      ),
  );
}

/** Documents: the file itself (drawn, or the one a partner sent), then the reviewer's actions. */
export default function customizeDocuments(collection) {
  collection.addField('file', {
    columnType: 'String',
    dependencies: render.DEPENDENCIES,
    getValues: drawDocuments,
  });
  addDocumentActions(collection);
}
