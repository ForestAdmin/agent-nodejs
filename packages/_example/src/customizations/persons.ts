import {
  ActionFieldType,
  ActionScope,
  Aggregation,
  AggregationOperation,
  ConditionTreeLeaf,
  Filter,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { Collection } from '@forestadmin/agent';

export default (collection: Collection) =>
  collection
    .registerField('fullName', {
      columnType: PrimitiveTypes.String,
      dependencies: ['firstName', 'lastName'],
      getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),

      filterBy: 'emulate',
      sortBy: [
        { field: 'firstName', ascending: true },
        { field: 'lastName', ascending: true },
      ],
    })

    .registerField('booksCount', {
      columnType: PrimitiveTypes.Number,
      dependencies: ['id'],
      getValues: async (persons, { dataSource }) => {
        const counts = await dataSource.getCollection('books').aggregate(
          new Filter({
            conditionTree: new ConditionTreeLeaf(
              'author:id',
              Operator.In,
              persons.map(p => p.id),
            ),
          }),
          new Aggregation({
            operation: AggregationOperation.Count,
            groups: [{ field: 'author:id' }],
          }),
        );

        return persons.map(person => {
          const count = counts.find(c => c.group['author:id'] === person.id);

          return count?.value ?? 0;
        });
      },

      filterBy: 'emulate',
    })

    .implementWrite('fullName', async patch => {
      const [firstName, lastName] = (patch as string).split(' ');

      return { firstName, lastName };
    })

    .registerAction('Tell me a greeting', {
      scope: ActionScope.Single,
      form: [
        {
          label: 'How should we refer to you?',
          type: ActionFieldType.Enum,
          if: async context => {
            const person = await context.getRecord(['firstName', 'lastName', 'fullName']);

            return Boolean(person.firstName || person.fullName);
          },
          defaultValue: '👋',
          enumValues: async context => {
            const person = await context.getRecord(['firstName', 'lastName', 'fullName']);

            return [
              person.firstName,
              person.fullName,
              `Mr. ${person.lastName}`,
              `Mrs. ${person.lastName}`,
              `Miss ${person.lastName}`,
            ];
          },
        },
      ],
      execute: async (context, responseBuilder) => {
        return responseBuilder.success(
          `Hello ${context.formValues['How should we refer to you?']}!`,
        );
      },
    })

    .registerAction('Mark as available (Single)', {
      scope: ActionScope.Single,
      execute: async (context, responseBuilder) => {
        await context.collection.update(context.filter, { firstName: 'Anonymized' });

        return responseBuilder.success('Book marked as available!');
      },
    })

    .registerAction('Charge credit card', {
      scope: ActionScope.Bulk,
      form: [
        {
          label: 'Amount',
          description: 'The amount (USD) to charge the credit card. Example: 42.50',
          type: ActionFieldType.Number,
        },
        {
          label: 'Description',
          description: 'Explain the reason why you want to charge manually the customer here',
          isRequired: true,
          type: ActionFieldType.String,
        },
        {
          label: 'stripeId',
          isRequired: true,
          type: ActionFieldType.String,
        },
      ],
      execute: async (context, responseBuilder) => {
        // Add your business logic here
        try {
          return responseBuilder.success(`Amount charged!`);
        } catch (error) {
          return responseBuilder.error(`Failed to charge amount: ${error}`);
        }
      },
    })

    .registerAction('Mark as available (Global)', {
      scope: ActionScope.Global,
      execute: async (context, responseBuilder) => {
        return responseBuilder.success('Book marked as available!');
      },
    })

    .registerAction('Mark as available (Webhook)', {
      scope: ActionScope.Global,
      execute: async (context, responseBuilder) => {
        return responseBuilder.webhook(
          'http://my-company-name', // The url of the company providing the service.
          'POST', // The method you would like to use (typically a POST).
          {}, // You can add some headers if needed.
          { adminToken: 'your-admin-token' }, // A body to send to the url (only JSON supported).
        );
      },
    })

    .registerAction('Mark as available (File download)', {
      scope: ActionScope.Global,
      generateFile: true,
      execute: async (context, responseBuilder) => {
        return responseBuilder.file('streamOrBufferOrString', 'filename.txt', 'text/plain');
      },
    })

    .registerAction('Mark as available (Refresh related)', {
      scope: ActionScope.Global,
      generateFile: true,
      execute: async (context, responseBuilder) => {
        return responseBuilder.success('New transaction emitted', {
          type: 'text',
          invalidated: ['emitted_transactions'],
        });
      },
    })

    .registerAction('Mark as available (Redirect to)', {
      scope: ActionScope.Global,
      generateFile: true,
      execute: async (context, responseBuilder) => {
        return responseBuilder.redirectTo(
          '/MyProject/MyEnvironment/MyTeam/data/20/index/record/20/108/activity',
        );
      },
    })

    .registerSegment(
      'Wrote more than 2 books',
      async () => new ConditionTreeLeaf('booksCount', Operator.GreaterThan, 2),
    );
