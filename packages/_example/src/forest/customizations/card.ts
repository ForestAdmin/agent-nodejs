import type { CardCustomizer } from '../typings';

export default (collection: CardCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' })
    .addAction('Create new card', {
      scope: 'Global',
      execute: (context, resultBuilder) => {
        return resultBuilder.success('ok');
      },
      form: [
        {
          type: 'Layout',
          component: 'Page',
          elements: [
            {
              type: 'String',
              label: 'Credit card plan',
              id: 'Plan',
              widget: 'Dropdown',
              options: ['Base', 'Gold', 'Black'],
              isRequired: true,
            },
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: ctx => {
                if (!ctx.formValues.Plan) {
                  return 'Please select a card Plan';
                }

                let info = '';

                switch (ctx.formValues.Plan) {
                  case 'Base':
                    info = `
                            <li>price</li>
                            <li>max withdraw / max payment</li>`;
                    break;
                  case 'Gold':
                    info = `<li>max payment / Systematic check (if max payment > 1000)</li>
                            <li>discount / discount months</li>`;
                    break;
                  case 'Black':
                    info = `<li>max withdraw</li>`;
                    break;
                  default:
                }

                return `
                  <h3>The <b>${ctx.formValues.Plan}</b> plan requires the following info to be provided:</h3>
                  <ul>${info}</ul>
                  <p>You will be asked to provide them in the next pages</p>
                  `;
              },
            },
          ],
        },
        {
          type: 'Layout',
          component: 'Page',
          nextButtonLabel: 'go to next page',
          previousButtonLabel: 'go to previous page',
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: 'This is an empty page',
            },
          ],
        },
        {
          type: 'Layout',
          component: 'Page',
          elements: [], // this empty page will be trimmed and not shown in the final form
        },
        {
          type: 'Layout',
          component: 'Page',
          elements: [
            {
              type: 'Number',
              label: 'price',
              defaultValue: 40,
            },
            { type: 'Layout', component: 'Separator' },
            { type: 'Layout', component: 'HtmlBlock', content: '<h3>constraints:</h3>' },
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                {
                  type: 'Number',
                  label: 'Max withdraw',
                  if: ctx => ['Base', 'Black'].includes(ctx.formValues.Plan),
                },
                {
                  type: 'Number',
                  label: 'Max payment',
                  if: ctx => ['Base', 'Gold'].includes(ctx.formValues.Plan),
                },
                {
                  type: 'Boolean',
                  label: 'Systematic check',
                  if: ctx =>
                    ['Base', 'Gold'].includes(ctx.formValues.Plan) &&
                    ctx.formValues['Max payment'] > 1000,
                },
              ],
            },
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                {
                  type: 'Number',
                  label: 'Discount',
                  widget: 'NumberInput',
                  min: 0,
                  max: 1,
                  description: ctx => `${(ctx.formValues.Discount || 0) * 100}%`,
                  if: ctx => ['Gold'].includes(ctx.formValues.Plan),
                },
                {
                  type: 'Number',
                  widget: 'NumberInput',
                  label: 'Discount duration',
                  min: 1,
                  step: 1,
                  max: 12,
                  description: 'How long should the discount apply for (in month)',
                  if: ctx => ['Gold'].includes(ctx.formValues.Plan),
                },
              ],
            },
          ],
        },
      ],
    })
    .addAction('Test Dynamic Form', {
      scope: 'Single',
      form: [
        // Type d'opération - contrôle la visibilité des autres champs
        {
          label: 'Operation type',
          type: 'Enum',
          enumValues: ['Transfer', 'Withdrawal', 'Deposit'],
          isRequired: true,
        },
        // Montant - toujours visible et requis
        {
          label: 'Amount',
          type: 'Number',
          isRequired: true,
          defaultValue: 100,
        },
        // Compte destination - visible seulement pour Transfer
        {
          label: 'Destination account',
          type: 'String',
          if: ctx => ctx.formValues['Operation type'] === 'Transfer',
          isRequired: ctx => ctx.formValues['Operation type'] === 'Transfer',
        },
        // Référence - requis si Transfer ET montant > 1000
        {
          label: 'Transfer reference',
          type: 'String',
          if: ctx => ctx.formValues['Operation type'] === 'Transfer',
          isRequired: ctx =>
            ctx.formValues['Operation type'] === 'Transfer' && (ctx.formValues.Amount || 0) > 1000,
          description: ctx =>
            (ctx.formValues.Amount || 0) > 1000
              ? 'Required for transfers over 1000'
              : 'Optional for small transfers',
        },
        // Raison de retrait - visible seulement pour Withdrawal
        {
          label: 'Withdrawal reason',
          type: 'Enum',
          enumValues: ['Personal', 'Business', 'Emergency'],
          if: ctx => ctx.formValues['Operation type'] === 'Withdrawal',
        },
        // Priorité - options différentes selon le montant
        {
          label: 'Priority',
          type: 'Enum',
          enumValues: ctx => {
            const amount = ctx.formValues.Amount || 0;
            if (amount > 5000) return ['Standard', 'Express', 'Urgent'];

            return ['Standard', 'Express'];
          },
          defaultValue: 'Standard',
        },
        // Confirmation - apparaît pour les gros montants
        {
          label: 'Confirm large amount',
          type: 'Boolean',
          if: ctx => (ctx.formValues.Amount || 0) > 10000,
          isRequired: ctx => (ctx.formValues.Amount || 0) > 10000,
          description: 'You must confirm operations over 10,000',
        },
      ],
      execute: async (context, resultBuilder) => {
        const values = context.formValues;

        return resultBuilder.success(
          `Operation ${values['Operation type']} of ${values.Amount} processed`,
        );
      },
    });
