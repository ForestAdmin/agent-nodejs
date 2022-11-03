import { Factory } from 'fishery';

import ChartHandlerService from '../../../src/charts/chart-handler';
import contextVariablesInstantiatorFactory from '../utils/context-variables-instantiator';

export class ChartHandlerFactory extends Factory<ChartHandlerService> {
  mockAllMethods() {
    return this.afterBuild(chartHandler => {
      chartHandler.getChartWithContextInjected = jest.fn();
      chartHandler.getQueryForChart = jest.fn();
    });
  }
}

const chartHandlerFactory = ChartHandlerFactory.define(
  () => new ChartHandlerService(contextVariablesInstantiatorFactory.build()),
);

export default chartHandlerFactory;
