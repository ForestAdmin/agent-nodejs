import type { ReviewCustomizer } from '../typings';

export default (collection: ReviewCustomizer) =>
  collection
    .addManyToOneRelation('store', 'store', { foreignKey: 'storeId' })

    .addAction('Attach a document', {
      scope: 'Single',
      form: [
        { label: 'Document', type: 'File', isRequired: true },
        { label: 'Extra pages', type: 'FileList' },
        { label: 'Note', type: 'String' },
      ],
      execute: async (context, resultBuilder) => {
        const document = context.formValues.Document as {
          name: string;
          mimeType: string;
          buffer: Buffer;
        };
        const extras = (context.formValues['Extra pages'] ?? []) as (typeof document)[];

        const describe = (file: typeof document) =>
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
