import {
  ActionCollectionDecorator,
  ActionFieldType,
  ActionScope,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import { DummyDataSource } from '@forestadmin/datasource-dummy';

const prepareDataSource = async (): Promise<DummyDataSource> => {
  let dataSource = new DummyDataSource();
  dataSource = new DataSourceDecorator(dataSource, OperatorsEmulateCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, OperatorsReplaceCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SortEmulateCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SegmentCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, RenameCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, PublicationCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SearchCollectionDecorator);

  const agentBuilder = new DataSourceDecorator(dataSource, ActionCollectionDecorator);

  agentBuilder.getCollection('books').registerAction('Leave a review', {
    scope: ActionScope.Single,
    form: [
      {
        label: 'original title',
        type: ActionFieldType.String,
        isReadOnly: true,
        defaultValue: context =>
          context
            .getRecord(['title', 'author:firstName', 'author:lastName'])
            .then(book => `${book.title} (by ${book.author.firstName} ${book.author.lastName})`),
      },
      {
        label: 'rating',
        type: ActionFieldType.Enum,
        enumValues: ['keep away 🤮', 'meeeh 🤷', 'good enough 👍', 'nice! 🤪', 'great 🎉'],
        defaultValue: 'good enough 👍',
        value: context =>
          context.formValues.rating === 'keep away 🤮' ? 'meeeh 🤷' : context.formValues.rating,
      },
      {
        label: 'country',
        type: ActionFieldType.Enum,
        enumValues: ['France', 'Spain'],
      },
      {
        label: 'region',
        type: ActionFieldType.Enum,
        isReadOnly: context => !context.formValues.country,
        enumValues: context => {
          const { country } = context.formValues;
          if (country === 'France') return ['poitou', 'idf'];
          if (country === 'Spain') return ['país basco', 'madrid'];

          return [];
        },
      },
      {
        label: 'want to make a paypal donation?',
        type: ActionFieldType.Boolean,
        if: context => context.formValues.rating === 'great 🎉',
      },
    ],

    execute: (context, responseBuilder) => {
      // Do stuff here 💪

      // When you are done, call the response builder
      return responseBuilder.success(
        context.formValues['want to make a paypal donation?']
          ? 'Thank you for for the money 💰'
          : 'Thank you for leaving a review 🤪',
      );
    },
  });

  return agentBuilder;
};

export default prepareDataSource;
