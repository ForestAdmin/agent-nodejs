import { CardCustomizer } from '../typings';

export type NotificationFromAgent = {
  notification:
    | { refresh: { collectionName: string; recordIds?: string[] } }
    | { message: { type: 'success' | 'info' | 'warning' | 'error'; text: string } };
  target?: { users?: string[]; team?: string; roles?: string[] };
};

const send = async (notif: NotificationFromAgent, resultBuilder?) => {
  const resp = await fetch(
    `https://api.development.forestadmin.com/liana/notifications-from-agent`,
    {
      method: 'POST',
      body: JSON.stringify(notif),
      headers: {
        'forest-secret-key': '5eb3ab09768a960a059bfaac57db9e1d2b33633a6d37cd4c13e19100c553bf14',
        'Content-Type': 'application/json',
      },
    },
  );

  return resultBuilder?.success(`Notif sent !!!`);
};

export default (collection: CardCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' })
    .addAction('trigger notif to everyone', {
      scope: 'Global',
      async execute(context, resultBuilder) {
        const notif: NotificationFromAgent = {
          notification: {
            message: {
              type: 'warning',
              text: 'Data refreshed',
            },
            refresh: {
              collectionName: 'card',
            },
          },
        };

        return send(notif, resultBuilder);
      },
    })
    .addAction('trigger notif to nicolas@email.com', {
      scope: 'Global',
      async execute(context, resultBuilder) {
        const notif: NotificationFromAgent = {
          notification: {
            message: {
              type: 'warning',
              text: 'Your data has been refreshed Nicolas',
            },
            refresh: {
              collectionName: 'card',
            },
          },
          target: { users: ['nicolas@email.com'] },
        };

        return send(notif, resultBuilder);
      },
    })
    .addAction('send love to…', {
      scope: 'Global',
      submitButtonLabel: '😘',
      form: [
        {
          label: 'Who do you love?',
          id: 'loved',
          type: 'StringList',
          widget: 'UserDropdown',
        },
      ],
      async execute(context, resultBuilder) {
        const notif: NotificationFromAgent = {
          notification: {
            message: {
              type: 'info',
              text: `❤️ ${context.caller.firstName} ${context.caller.lastName} loves you ❤️`,
            },
          },
          target: { users: context.formValues.loved },
        };

        return send(notif, resultBuilder);
      },
    })
    .addAction('create new card', {
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
    .addAction('Escalate', {
      scope: 'Single',
      execute: async (context, resultBuilder) => {
        await context.collection.update(context.filter, { is_active: false });

        const notif: NotificationFromAgent = {
          notification: {
            message: {
              type: 'warning',
              text: 'A new card has been escalated',
            },
            refresh: {
              collectionName: 'card',
            },
          },
          target: { users: ['nicolas@email.com'] },
        };
        await send(notif, resultBuilder);

        return resultBuilder.success('Card escalated to back office');
      },
    });
