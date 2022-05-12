import { Chart } from '../../interfaces/chart';
import AgentCustomizationContext from '../../context/agent-context';
import ResultBuilder from './result-builder';

export type ChartDefinition = (
  context: AgentCustomizationContext,
  resultBuilder: ResultBuilder,
) => Promise<Chart> | Chart;
