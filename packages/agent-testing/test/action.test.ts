import { Agent } from '@forestadmin/agent';
import { buildSequelizeInstance, createSqlDataSource } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { STORAGE_PREFIX, logger } from '../example/utils';
import { TestableAgent, createTestableAgent } from '../src';
import ActionFieldJson from '../src/remote-agent-client/action-fields/action-field-json';
import ActionFieldStringList from '../src/remote-agent-client/action-fields/action-field-string-list';

describe('action', () => {
  let testableAgent: TestableAgent;
  let sequelize: Awaited<ReturnType<typeof buildSequelizeInstance>>;
  let restaurantId: number;
  const storage = `${STORAGE_PREFIX}-action-test.db`;

  const actionFormCustomizer = (agent: Agent) => {
    agent.customizeCollection('restaurants', collection => {
      collection.addAction('Leave a review', {
        scope: 'Single',
        form: [
          {
            type: 'Layout',
            component: 'Page',
            nextButtonLabel: 'Next',
            previousButtonLabel: 'Back',
            elements: [
              {
                component: 'Separator',
                type: 'Layout',
              },
              { label: 'Metadata', type: 'Json', widget: 'JsonEditor' },
              { component: 'HtmlBlock', content: '<h1>Welcome</h1>', type: 'Layout' },
              { label: 'rating', type: 'Number', isRequired: true },
              {
                label: 'Put a comment',
                type: 'String',
                // Only display this field if the rating is >= 4
                if: context => Number(context.formValues.rating) >= 4,
              },
              {
                label: 'Would you recommend us?',
                type: 'String',
                widget: 'RadioGroup',
                options: [
                  { value: 'yes', label: 'Yes, absolutely!' },
                  { value: 'no', label: 'Not really...' },
                ],
                defaultValue: 'yes',
              },
              {
                label: 'Why do you like us?',
                type: 'StringList',
                widget: 'CheckboxGroup',
                options: [
                  { value: 'price', label: 'Good price' },
                  { value: 'quality', label: 'Build quality' },
                  { value: 'look', label: 'It looks good' },
                ],
              },
              {
                label: 'Current id',
                type: 'Number',
                defaultValue: async context => Number(await context.getRecordId()),
              },
              {
                label: 'enum',
                type: 'Enum',
                enumValues: ['opt1', 'opt2'],
              },
            ],
          },

          {
            type: 'Layout',
            component: 'Page',
            nextButtonLabel: 'Bye',
            previousButtonLabel: 'Back',
            elements: [
              { component: 'Separator', type: 'Layout' },
              { type: 'Layout', component: 'HtmlBlock', content: '<h1>Thank you</h1>' },
              { component: 'Separator', type: 'Layout' },
              {
                component: 'Row',
                type: 'Layout',
                fields: [
                  { label: 'Rating again', type: 'Number' },
                  { label: 'Put a comment again', type: 'String' },
                ],
              },
            ],
          },
        ],
        execute: async context => {
          const rating = Number(context.formValues.rating);
          const comment = context.formValues['Put a comment'];
          const metadata = context.formValues.Metadata;

          const { id } = await context.getRecord(['id']);
          await context.dataSource.getCollection('restaurants').update(
            {
              conditionTree: { field: 'id', operator: 'Equal', value: id },
            },
            { comment, rating, metadata },
          );
        },
      });
    });
  };

  const createTable = async () => {
    sequelize = await buildSequelizeInstance({ dialect: 'sqlite', storage }, logger);

    sequelize.define(
      'restaurants',
      {
        name: { type: DataTypes.STRING },
        rating: { type: DataTypes.INTEGER },
        comment: { type: DataTypes.STRING },
        metadata: { type: DataTypes.JSONB },
      },
      { tableName: 'restaurants' },
    );
    await sequelize.sync({ force: true });
  };

  beforeAll(async () => {
    await createTable();
    testableAgent = await createTestableAgent((agent: Agent) => {
      agent.addDataSource(createSqlDataSource({ dialect: 'sqlite', storage }));
      actionFormCustomizer(agent);
    });
    await testableAgent.start();
  });

  afterAll(async () => {
    await testableAgent?.stop();
    await sequelize?.close();
  });

  beforeEach(async () => {
    const createdRestaurant = await sequelize.models.restaurants.create({
      name: 'Best Forest Restaurant',
      rating: null,
      comment: null,
    });
    restaurantId = createdRestaurant.dataValues.id;
  });

  describe('getField', () => {
    it('should return the field', async () => {
      const action = await testableAgent
        .collection('restaurants')
        .action('Leave a review', { recordId: restaurantId });

      const jsonField = action.getField('Metadata');
      expect(jsonField).toBeInstanceOf(ActionFieldJson);

      const stringListField = action.getField('Why do you like us?');
      expect(stringListField).toBeInstanceOf(ActionFieldStringList);
    });
  });

  describe('setFields', () => {
    it('should set the fields', async () => {
      const action = await testableAgent
        .collection('restaurants')
        .action('Leave a review', { recordId: restaurantId });

      await action.setFields({
        Metadata: { key: 'value' },
        rating: 5,
        'Put a comment': 'Great food!',
        'Would you recommend us?': 'yes',
        'Why do you like us?': ['price', 'quality'],
        'Current id': restaurantId,
        enum: 'opt1',
        'Rating again': 4,
        'Put a comment again': 'Excellent service!',
      });

      expect(action.getField('Metadata').getValue()).toEqual({ key: 'value' });
      expect(action.getField('rating').getValue()).toEqual(5);
      expect(action.getField('Put a comment').getValue()).toEqual('Great food!');
      expect(action.getField('Would you recommend us?').getValue()).toEqual('yes');
      expect(action.getField('Why do you like us?').getValue()).toEqual(['price', 'quality']);
      expect(action.getField('Current id').getValue()).toEqual(restaurantId);
      expect(action.getField('enum').getValue()).toEqual('opt1');
      expect(action.getField('Rating again').getValue()).toEqual(4);
      expect(action.getField('Put a comment again').getValue()).toEqual('Excellent service!');
    });
  });

  describe('getFields', () => {
    it('should return all fields', async () => {
      const action = await testableAgent
        .collection('restaurants')
        .action('Leave a review', { recordId: restaurantId });

      const fields = action.getFields();

      expect(fields.length).toBe(8);
      expect(fields.map(f => f.getName())).toEqual([
        'Metadata',
        'rating',
        'Would you recommend us?',
        'Why do you like us?',
        'Current id',
        'enum',
        'Rating again',
        'Put a comment again',
      ]);
      expect(fields.map(f => f.getType())).toEqual([
        'Json',
        'Number',
        'String',
        ['String'],
        'Number',
        'Enum',
        'Number',
        'String',
      ]);
      expect(fields.map(f => f.getValue())).toEqual([
        undefined,
        undefined,
        'yes',
        undefined,
        restaurantId,
        null,
        undefined,
        undefined,
      ]);
    });
  });
});
