import { Chart } from '@forestadmin/datasource-toolkit';

import CollectionChartContext from './context';
import ResultBuilder from './result-builder';
import AgentCustomizationContext from '../../context/agent-context';
import { TCollectionName, TSchema } from '../../templates';

export type DataSourceChartDefinition<S extends TSchema = TSchema> = (
  context: AgentCustomizationContext<S>,
  resultBuilder: ResultBuilder,
) => Promise<Chart> | Chart;

export type CollectionChartDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: CollectionChartContext<S, N>, resultBuilder: ResultBuilder) => Promise<Chart> | Chart;
