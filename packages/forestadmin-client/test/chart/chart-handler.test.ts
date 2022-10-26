import ChartHandlerService, { ChartRequest } from '../../src/charts/chart-handler';
import { ChartType, PieChart, ValueChart, LeaderboardChart, ObjectiveChart, LineChart } from '../../src/charts/types';
import ActionPermissionService from '../../src/permissions/action-permission';
import ForestHttpApi from '../../src/permissions/forest-http-api';
import generateActionsFromPermissions, {
  ActionPermissions,
} from '../../src/permissions/generate-actions-from-permissions';
import ContextVariablesInjector from '../../src/utils/context-variables-injector';
import { contextVariablesInstantiator } from '../__factories__';
import contextVariablesInstantiatorFactory, { ContextVariablesInstantiatorFactory } from '../__factories__/utils/context-variables-instantiator';
import type { PlainConditionTreeBranch } from '@forestadmin/datasource-toolkit';

jest.mock('../../src/permissions/forest-http-api', () => ({
  getUsers: jest.fn(),
  getEnvironmentPermissions: jest.fn(),
}));

jest.mock('../../src/permissions/generate-actions-from-permissions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const generateActionsFromPermissionsMock = generateActionsFromPermissions as jest.Mock;
const getUsersMock = ForestHttpApi.getUsers as jest.Mock;
const getEnvironmentPermissionsMock = ForestHttpApi.getEnvironmentPermissions as jest.Mock;

describe('ChartHandlerService', () => {
  function setup() {
    const contextVariablesInstantiator = contextVariablesInstantiatorFactory.mockAllMethods().build();
    const service = new ChartHandlerService(contextVariablesInstantiator);

    const users = [
      { id: 1, roleId: 1 },
      { id: 2, roleId: 2 },
    ];
    const contextVariables = { test: 'me' };

    const buildContextVariablesMock = contextVariablesInstantiator.buildContextVariables as jest.Mock;
    buildContextVariablesMock.mockResolvedValue(contextVariables)

    return { service, users, contextVariablesInstantiator, contextVariables };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getChart', () => {
    describe('with a Pie chart', () => {
      test('it should replace filter and aggregator when using context', async () => {
        const { contextVariables, contextVariablesInstantiator, service } = setup();
        
        const injectedFilter: PlainConditionTreeBranch = { aggregator: 'And', conditions: [{ field: 'test', operator: 'Equal', value: 'me' }] };
        jest.spyOn(ContextVariablesInjector, 'injectContextInFilter').mockReturnValue(injectedFilter);
        jest.spyOn(ContextVariablesInjector, 'injectContextInValue').mockReturnValue('Sum');

        const filter: PlainConditionTreeBranch = {
          aggregator:'Or',
          conditions: [{
            field: 'name',
            operator: 'Equal',
            value: '{{masters.selectedRecord.name}}',
          }]
        };
        const requestContextVariables = { 'you': 'are' };
        const chartRequest: ChartRequest<PieChart> = {
          type: ChartType.Pie,
          aggregator: '{{aggregators.selectedValue}}' as 'Sum' | 'Count',
          aggregateFieldName: 'length',
          groupByFieldName: 'name',
          sourceCollectionName: 'siths',
          filter,
          contextVariables: requestContextVariables,
        };

        const userId = 10;
        const renderingId = 11;

        const chart = await service.getChart({ userId, renderingId, chartRequest });

        expect(chart).toStrictEqual({
          type: ChartType.Pie,
          aggregator: 'Sum',
          aggregateFieldName: 'length',
          groupByFieldName: 'name',
          sourceCollectionName: 'siths',
          filter: injectedFilter,
        });
        expect(ContextVariablesInjector.injectContextInFilter).toHaveBeenCalledWith(
          filter,
          contextVariables,
        );
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{aggregators.selectedValue}}',
          contextVariables,
        );
        expect(contextVariablesInstantiator.buildContextVariables).toHaveBeenCalledWith({
          userId,
          renderingId,
          requestContextVariables,
        })
      });
    });

    describe('with a Value chart', () => {
      test('it should replace filter and aggregator when using context', async () => {
        const { contextVariables, contextVariablesInstantiator, service } = setup();
        
        const injectedFilter: PlainConditionTreeBranch = { aggregator: 'And', conditions: [{ field: 'test', operator: 'Equal', value: 'me' }] };
        jest.spyOn(ContextVariablesInjector, 'injectContextInFilter').mockReturnValue(injectedFilter);
        jest.spyOn(ContextVariablesInjector, 'injectContextInValue').mockReturnValue('Sum');

        const filter: PlainConditionTreeBranch = {
          aggregator:'Or',
          conditions: [{
            field: 'name',
            operator: 'Equal',
            value: '{{masters.selectedRecord.name}}',
          }]
        };
        const requestContextVariables = { 'you': 'are' };
        const chartRequest: ChartRequest<ValueChart> = {
          type: ChartType.Value,
          aggregator: '{{aggregators.selectedValue}}' as 'Sum' | 'Count',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          filter,
          contextVariables: requestContextVariables,
        };

        const userId = 10;
        const renderingId = 11;

        const chart = await service.getChart({ userId, renderingId, chartRequest });

        expect(chart).toStrictEqual({
          type: ChartType.Value,
          aggregator: 'Sum',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          filter: injectedFilter,
        });
        expect(ContextVariablesInjector.injectContextInFilter).toHaveBeenCalledWith(
          filter,
          contextVariables,
        );
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{aggregators.selectedValue}}',
          contextVariables,
        );
        expect(contextVariablesInstantiator.buildContextVariables).toHaveBeenCalledWith({
          userId,
          renderingId,
          requestContextVariables,
        })
      });
    });

    describe('with a Objective chart', () => {
      test('it should replace filter and aggregator when using context', async () => {
        const { contextVariables, contextVariablesInstantiator, service } = setup();
        
        const injectedFilter: PlainConditionTreeBranch = { aggregator: 'And', conditions: [{ field: 'test', operator: 'Equal', value: 'me' }] };
        jest.spyOn(ContextVariablesInjector, 'injectContextInFilter').mockReturnValue(injectedFilter);
        jest.spyOn(ContextVariablesInjector, 'injectContextInValue').mockImplementation(value => value === '{{aggregators.selectedValue}}' ? 'Sum' : 134);

        const filter: PlainConditionTreeBranch = {
          aggregator:'Or',
          conditions: [{
            field: 'name',
            operator: 'Equal',
            value: '{{masters.selectedRecord.name}}',
          }]
        };
        const requestContextVariables = { 'you': 'are' };
        const chartRequest: ChartRequest<ObjectiveChart> = {
          type: ChartType.Objective,
          aggregator: '{{aggregators.selectedValue}}' as 'Sum' | 'Count',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          objective: '{{objective.amount}}' as unknown as number,
          filter,
          contextVariables: requestContextVariables,
        };

        const userId = 10;
        const renderingId = 11;

        const chart = await service.getChart({ userId, renderingId, chartRequest });

        expect(chart).toStrictEqual({
          type: ChartType.Objective,
          aggregator: 'Sum',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          objective: 134,
          filter: injectedFilter,
        });
        expect(ContextVariablesInjector.injectContextInFilter).toHaveBeenCalledWith(
          filter,
          contextVariables,
        );
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{aggregators.selectedValue}}',
          contextVariables,
        );
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{objective.amount}}',
          contextVariables,
        );
        expect(contextVariablesInstantiator.buildContextVariables).toHaveBeenCalledWith({
          userId,
          renderingId,
          requestContextVariables,
        })
      });
    });

    describe('with a Line chart', () => {
      test('it should replace filter and aggregator when using context', async () => {
        const { contextVariables, contextVariablesInstantiator, service } = setup();
        
        const injectedFilter: PlainConditionTreeBranch = { aggregator: 'And', conditions: [{ field: 'test', operator: 'Equal', value: 'me' }] };
        jest.spyOn(ContextVariablesInjector, 'injectContextInFilter').mockReturnValue(injectedFilter);
        jest.spyOn(ContextVariablesInjector, 'injectContextInValue').mockImplementation(value => value === '{{aggregators.selectedValue}}' ? 'Sum' : 'Year');

        const filter: PlainConditionTreeBranch = {
          aggregator:'Or',
          conditions: [{
            field: 'name',
            operator: 'Equal',
            value: '{{masters.selectedRecord.name}}',
          }]
        };
        const requestContextVariables = { 'you': 'are' };
        const chartRequest: ChartRequest<LineChart> = {
          type: ChartType.Line,
          aggregator: '{{aggregators.selectedValue}}' as 'Sum' | 'Count',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          groupByFieldName: 'creationDate',
          timeRange: '{{timeRange.selectedValue}}' as 'Year',
          filter,
          contextVariables: requestContextVariables,
        };

        const userId = 10;
        const renderingId = 11;

        const chart = await service.getChart({ userId, renderingId, chartRequest });

        expect(chart).toStrictEqual({
          type: ChartType.Line,
          aggregator: 'Sum',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          groupByFieldName: 'creationDate',
          timeRange: 'Year',
          filter: injectedFilter,
        });
        expect(ContextVariablesInjector.injectContextInFilter).toHaveBeenCalledWith(
          filter,
          contextVariables,
        );
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{aggregators.selectedValue}}',
          contextVariables,
        );
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{timeRange.selectedValue}}',
          contextVariables,
        );
        expect(contextVariablesInstantiator.buildContextVariables).toHaveBeenCalledWith({
          userId,
          renderingId,
          requestContextVariables,
        })
      });
    });

    describe('with a Leaderboard chart', () => {
      test('it should replace filter and aggregator when using context', async () => {
        const { contextVariables, contextVariablesInstantiator, service } = setup();
        
        const injectedFilter: PlainConditionTreeBranch = { aggregator: 'And', conditions: [{ field: 'test', operator: 'Equal', value: 'me' }] };
        jest.spyOn(ContextVariablesInjector, 'injectContextInValue').mockImplementation(value => value === '{{aggregators.selectedValue}}' ? 'Sum' : 13);

        const filter: PlainConditionTreeBranch = {
          aggregator:'Or',
          conditions: [{
            field: 'name',
            operator: 'Equal',
            value: '{{masters.selectedRecord.name}}',
          }]
        };
        const requestContextVariables = { 'you': 'are' };
        const chartRequest: ChartRequest<LeaderboardChart> = {
          type: ChartType.Leaderboard,
          aggregator: '{{aggregators.selectedValue}}' as 'Sum' | 'Count',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          labelFieldName: 'name',
          relationshipFieldName: 'padawan',
          limit: '{{myLimit}}' as unknown as number,
          contextVariables: requestContextVariables,
        };

        const userId = 10;
        const renderingId = 11;

        const chart = await service.getChart({ userId, renderingId, chartRequest });

        expect(chart).toStrictEqual({
          type: ChartType.Leaderboard,
          aggregator: 'Sum',
          aggregateFieldName: 'length',
          sourceCollectionName: 'siths',
          labelFieldName: 'name',
          relationshipFieldName: 'padawan',
          limit: 13,
        });
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{aggregators.selectedValue}}',
          contextVariables,
        );
        expect(ContextVariablesInjector.injectContextInValue).toHaveBeenCalledWith(
          '{{myLimit}}',
          contextVariables,
        );
        expect(contextVariablesInstantiator.buildContextVariables).toHaveBeenCalledWith({
          userId,
          renderingId,
          requestContextVariables,
        })
      });
    });
  });
});
