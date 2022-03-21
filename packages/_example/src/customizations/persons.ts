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

    .registerAction('Tell me a greeting', {
      scope: ActionScope.Single,
      form: [
        {
          label: 'How should we refer to you?',
          type: ActionFieldType.Enum,
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
        {
          label: 'Language',
          type: ActionFieldType.Enum,
          enumValues: ['French', 'Spanish', 'English'],
        },
      ],
      execute: async (context, responseBuilder) => {
        return responseBuilder.success(
          `Hello ${context.formValues['How should we refer to you?']}!`,
        );
      },
    })

    .registerSegment(
      'Wrote more than 2 books',
      async () => new ConditionTreeLeaf('booksCount', Operator.GreaterThan, 2),
    );
