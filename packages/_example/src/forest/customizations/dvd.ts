import sequelizeMsSql from '../../connections/sequelize-mssql';
import { DvdCustomizer } from '../typings';

export default (collection: DvdCustomizer) =>
  collection
    .addManyToOneRelation('store', 'store', { foreignKey: 'storeId' })
    .renameField('rentalPrice', 'rentalPriceInDollar')
    .addField('numberOfRentals', {
      columnType: 'Number',
      dependencies: ['id'],
      getValues: async (records, context) => {
        const rows = await context.collection.nativeDriver.rawQuery(
          'SELECT dvd_id, COUNT(*) AS count FROM dvd_rental WHERE dvd_id IN (:ids) GROUP BY dvd_id',
          { ids: records.map(r => r.id) },
        );

        // getValues should return values in the same order than the initial `records` array.
        return records.map(record => rows.find(r => r.dvd_id === record.id)?.count ?? 0);
      },
    })
    .addAction('Increase the rental price', {
      scope: 'Bulk',
      form: [{ label: 'percentage', type: 'Number', defaultValue: 10, isRequired: true }],
      execute: async (context, resultBuilder) => {
        // Increase prices
        const replacements = {
          multiplier: 1 + context.formValues.percentage / 100,
          ids: await context.getRecordIds(),
        };

        await sequelizeMsSql.query(
          'UPDATE dvd SET rental_price = ROUND(rental_price * :multiplier, 2) WHERE id IN (:ids)',
          { replacements },
        );

        // Customize success message.
        return resultBuilder.success(`Rental price increased`);
      },
    })
    // Action with File upload, Multi-page form, and Dynamic fields
    .addAction('Add DVD to Collection', {
      scope: 'Global',
      form: [
        // Page 1: Basic DVD Information
        {
          type: 'Layout',
          component: 'Page',
          nextButtonLabel: 'Next: Media Files',
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: '<h2>Add a New DVD</h2><p>Enter the basic information about the DVD.</p>',
            },
            { type: 'Layout', component: 'Separator' },
            { label: 'Title', type: 'String', isRequired: true },
            {
              label: 'Genre',
              type: 'Enum',
              enumValues: [
                'Action',
                'Comedy',
                'Drama',
                'Horror',
                'Sci-Fi',
                'Documentary',
                'Animation',
              ],
              isRequired: true,
            },
            {
              label: 'Release Year',
              type: 'Number',
              defaultValue: new Date().getFullYear(),
            },
            {
              label: 'Is Special Edition',
              type: 'Boolean',
              widget: 'Checkbox',
              defaultValue: false,
            },
            // Dynamic field: only visible when special edition is checked
            {
              label: 'Special Edition Name',
              type: 'String',
              if: ctx => ctx.formValues['Is Special Edition'] === true,
            },
          ],
        },

        // Page 2: Media Files
        {
          type: 'Layout',
          component: 'Page',
          nextButtonLabel: 'Next: Details',
          previousButtonLabel: 'Back',
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: '<h2>Media Files</h2><p>Upload cover image and other media.</p>',
            },
            { type: 'Layout', component: 'Separator' },
            {
              label: 'Cover Image',
              type: 'File',
              description: 'Upload the DVD cover image (JPEG, PNG)',
            },
            {
              label: 'Trailer Video',
              type: 'File',
              description: 'Optional: Upload a trailer video',
            },
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                { label: 'Duration (minutes)', type: 'Number', isRequired: true },
                { label: 'Disc Count', type: 'Number', defaultValue: 1 },
              ],
            },
            {
              label: 'Audio Languages',
              type: 'StringList',
              widget: 'CheckboxGroup',
              options: [
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'French' },
                { value: 'es', label: 'Spanish' },
                { value: 'de', label: 'German' },
                { value: 'ja', label: 'Japanese' },
              ],
            },
          ],
        },

        // Page 3: Additional Details
        {
          type: 'Layout',
          component: 'Page',
          nextButtonLabel: 'Create DVD',
          previousButtonLabel: 'Back',
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: '<h2>Additional Details</h2><p>Add any extra information.</p>',
            },
            { type: 'Layout', component: 'Separator' },
            {
              label: 'Description',
              type: 'String',
              widget: 'TextArea',
            },
            { label: 'Director', type: 'String' },
            {
              label: 'Main Cast',
              type: 'StringList',
              widget: 'TextInputList',
            },
            {
              label: 'Rating',
              type: 'Enum',
              enumValues: ['G', 'PG', 'PG-13', 'R', 'NC-17'],
            },
            {
              label: 'Price Category',
              type: 'String',
              widget: 'RadioGroup',
              options: [
                { value: 'budget', label: 'Budget ($5-10)' },
                { value: 'standard', label: 'Standard ($10-20)' },
                { value: 'premium', label: 'Premium ($20-30)' },
                { value: 'collector', label: 'Collector ($30+)' },
              ],
              defaultValue: 'standard',
            },
            // Dynamic field: only visible for Horror genre
            {
              label: 'Scare Level (1-10)',
              type: 'Number',
              if: ctx => ctx.formValues.Genre === 'Horror',
            },
            {
              label: 'Extra Metadata',
              type: 'Json',
              widget: 'JsonEditor',
            },
          ],
        },
      ],
      execute: async (context, resultBuilder) => {
        const title = context.formValues.Title as string;
        const genre = context.formValues.Genre as string;
        const coverImage = context.formValues['Cover Image'] as {
          name: string;
          mimeType: string;
        } | null;

        // Log all form values for testing
        console.log('DVD Form Values:', JSON.stringify(context.formValues, null, 2));

        // In a real scenario, you would save the DVD to the database
        // For now, just return a success message with the details
        return resultBuilder.success(
          `DVD "${title}" (${genre}) would be added to the collection!${
            coverImage ? ` Cover: ${coverImage.name}` : ''
          }`,
        );
      },
    })
    // Action that returns a file
    .addAction('Generate DVD Label', {
      scope: 'Single',
      form: [
        {
          label: 'Label Format',
          type: 'Enum',
          enumValues: ['PDF', 'PNG', 'SVG'],
          defaultValue: 'PDF',
        },
        {
          label: 'Include Barcode',
          type: 'Boolean',
          widget: 'Checkbox',
          defaultValue: true,
        },
      ],
      execute: async (context, resultBuilder) => {
        const record = await context.getRecord(['title', 'rentalPrice']);
        const format = context.formValues['Label Format'] as string;
        const includeBarcode = context.formValues['Include Barcode'] as boolean;

        // Generate a simple label content
        const labelContent = `
DVD LABEL
=========
Title: ${record.title}
Price: $${record.rentalPrice}
${includeBarcode ? 'Barcode: ||||||||||||||||' : ''}
        `.trim();

        const mimeTypes: Record<string, string> = {
          PDF: 'application/pdf',
          PNG: 'image/png',
          SVG: 'image/svg+xml',
        };

        return resultBuilder.file(
          Buffer.from(labelContent),
          `${record.title}-label.${format.toLowerCase()}`,
          mimeTypes[format],
        );
      },
    });
