// eslint-disable-next-line max-classes-per-file
import BaseCollection from '../src/base-collection';
import BaseAction from '../src/base-action';
import { DataSource } from '../src/interfaces/collection';
import { Aggregation, AggregateResult } from '../src/interfaces/query/aggregation';
import { Projection } from '../src/interfaces/query/projection';
import { CompositeId, RecordData } from '../src/interfaces/query/record';
import { PaginatedFilter, Filter } from '../src/interfaces/query/selection';
import { ActionSchemaScope, CollectionSchema } from '../src/interfaces/schema';
import {
  SuccessReponse,
  WebHookReponse,
  FileResponse,
  RedirectResponse,
  ActionForm,
} from '../src/interfaces/action';

describe('BaseCollection', () => {
  class TestCollection extends BaseCollection {
    getById(id: CompositeId, projection: Projection): Promise<RecordData> {
      void id;
      void projection;
      throw new Error('Method not implemented.');
    }

    create(data: RecordData[]): Promise<RecordData[]> {
      void data;
      throw new Error('Method not implemented.');
    }

    list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
      void filter;
      void projection;
      throw new Error('Method not implemented.');
    }

    update(filter: Filter, patch: RecordData): Promise<void> {
      void filter;
      void patch;
      throw new Error('Method not implemented.');
    }

    delete(filter: Filter): Promise<void> {
      void filter;
      throw new Error('Method not implemented.');
    }

    aggregate(filter: PaginatedFilter, aggregation: Aggregation): Promise<AggregateResult[]> {
      void filter;
      void aggregation;
      throw new Error('Method not implemented.');
    }
  }

  class TestAction extends BaseAction {
    execute(
      formValues: RecordData,
      selection?: Selection,
    ): Promise<SuccessReponse | WebHookReponse | FileResponse | RedirectResponse> {
      void formValues;
      void selection;
      throw new Error('Method not implemented.');
    }

    getForm(
      selection?: Selection,
      changedField?: string,
      formValues?: RecordData,
    ): Promise<ActionForm> {
      void selection;
      void changedField;
      void formValues;
      throw new Error('Method not implemented.');
    }
  }
  describe('addAction', () => {
    it('should add the action to schema', () => {
      const collection = new TestCollection(
        'collectionTest',
        {} as DataSource,
        { actions: [] } as CollectionSchema,
      );

      const actionSchema = {
        name: 'actionTest',
        scope: ActionSchemaScope.Single,
        actionClass: TestAction,
      };

      collection.addAction(actionSchema);

      expect(collection.schema.actions).toHaveLength(1);
      expect(collection.schema.actions[0]).toBe(actionSchema);
    });

    it('should throw an error if the action already exist', () => {
      const collection = new TestCollection(
        'collectionTest',
        {} as DataSource,
        { actions: [] } as CollectionSchema,
      );

      const actionSchema = {
        name: 'actionTest',
        scope: ActionSchemaScope.Single,
        actionClass: TestAction,
      };

      collection.addAction(actionSchema);

      expect(() => collection.addAction(actionSchema)).toThrow(
        `Action "actionTest" already defined in collection`,
      );
    });
  });

  describe('getAction', () => {
    it('should get the right action', () => {
      const collection = new TestCollection(
        'collectionTest',
        {} as DataSource,
        {
          actions: [
            {
              name: 'actionTest',
              scope: ActionSchemaScope.Single,
              actionClass: TestAction,
            },
          ],
        } as unknown as CollectionSchema,
      );

      expect(collection.getAction('actionTest')).toBeInstanceOf(TestAction);
    });

    it('should thrown with an unknown action name', () => {
      const collection = new TestCollection(
        'collectionTest',
        {} as DataSource,
        { actions: [] } as CollectionSchema,
      );

      expect(() => collection.getAction('__no_such_action__')).toThrow(
        'Action "__no_such_action__" not found.',
      );
    });
  });
});
