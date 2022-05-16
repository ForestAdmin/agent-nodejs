import { Chart } from '../../interfaces/chart';
import { TSchema } from '../../interfaces/templates';
import AgentCustomizationContext from '../../context/agent-context';
import ResultBuilder from './result-builder';

export type ChartDefinition<S extends TSchema = TSchema> = (
  context: AgentCustomizationContext<S>,
  resultBuilder: ResultBuilder,
) => Promise<Chart> | Chart;
