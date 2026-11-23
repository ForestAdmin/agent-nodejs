import type { KycCasesCustomizer } from '../typings';

import { demoFields } from '../../connections/data-model';

type UploadedFile = { name: string; mimeType: string; buffer: Buffer };

const DECIDED_STATUSES = ['APPROVED', 'REJECTED'];
const REJECTION_CODES = demoFields('kyc_cases').find(field => field.name === 'rejection_code').enum;

const isRejection = ctx => ctx.formValues.Decision === 'REJECTED';

export default (collection: KycCasesCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customers', { foreignKey: 'customer_id' })

    .addAction('Approve or reject', {
      scope: 'Single',
      form: [
        { label: 'Decision', type: 'Enum', enumValues: DECIDED_STATUSES, isRequired: true },
        {
          label: 'Rejection code',
          type: 'Enum',
          enumValues: REJECTION_CODES,
          if: isRejection,
          isRequired: isRejection,
        },
        { label: 'Rejection reason', type: 'String', widget: 'TextArea', if: isRejection },
      ],
      execute: async (context, resultBuilder) => {
        const kycCase = await context.getRecord(['status', 'reference']);

        if (DECIDED_STATUSES.includes(kycCase.status)) {
          return resultBuilder.error(`${kycCase.reference} is already ${kycCase.status}`);
        }

        const decision = context.formValues.Decision;
        const now = new Date().toISOString();

        await context.collection.update(context.filter, {
          status: decision,
          decided_by: context.caller.email,
          resolved_at: now,
          updated_at: now,
          rejection_code: decision === 'REJECTED' ? context.formValues['Rejection code'] : null,
          rejection_reason: decision === 'REJECTED' ? context.formValues['Rejection reason'] : null,
        });

        return resultBuilder.success(`${kycCase.reference} ${decision.toLowerCase()}`);
      },
    })
    .addAction('Attach a document', {
      scope: 'Single',
      form: [
        { label: 'Document', type: 'File', isRequired: true },
        { label: 'Extra pages', type: 'FileList' },
        { label: 'Note', type: 'String' },
      ],
      execute: async (context, resultBuilder) => {
        const document = context.formValues.Document as UploadedFile;
        const extras = (context.formValues['Extra pages'] ?? []) as UploadedFile[];

        const describe = (file: UploadedFile) =>
          `${file?.name} (${file?.mimeType}, ${file?.buffer?.length} bytes)`;

        return resultBuilder.success(
          [
            `Received ${describe(document)}`,
            extras.length
              ? `plus ${extras.length}: ${extras.map(describe).join(', ')}`
              : 'no extras',
            `note: ${context.formValues.Note ?? '-'}`,
          ].join(' — '),
        );
      },
    });
