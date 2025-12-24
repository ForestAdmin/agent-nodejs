import type CollectionChartContext from './context';
import type ResultBuilder from './result-builder';
import type AgentCustomizationContext from '../../context/agent-context';
import type { TCollectionName, TSchema } from '../../templates';
import type { Chart } from '@forestadmin/datasource-toolkit';

export type DataSourceChartDefinition<S extends TSchema = TSchema> = (
  context: AgentCustomizationContext<S>,
  resultBuilder: ResultBuilder,
) => Promise<Chart> | Chart;

export type CollectionChartDefinition<
  S extends TSchema = TSchema,
  N extends TCollectionName<S> = TCollectionName<S>,
> = (context: CollectionChartContext<S, N>, resultBuilder: ResultBuilder) => Promise<Chart> | Chart;
