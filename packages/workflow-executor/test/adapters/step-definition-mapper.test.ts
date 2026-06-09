import type {
  ServerCloseSubWorkflow,
  ServerStartSubWorkflow,
  ServerWorkflowCondition,
  ServerWorkflowEnd,
  ServerWorkflowEscalation,
  ServerWorkflowStep,
  ServerWorkflowTask,
  ServerWorkflowTransition,
} from '../../src/adapters/server-types';

import {
  ServerStepExecutionTypeEnum,
  ServerStepTypeEnum,
  ServerTaskTypeEnum,
} from '../../src/adapters/server-types';
import toStepDefinition from '../../src/adapters/step-definition-mapper';
import { InvalidStepDefinitionError, UnsupportedStepTypeError } from '../../src/errors';
import { StepExecutionMode, StepType } from '../../src/types/validated/step-definition';

const defaultTransition: ServerWorkflowTransition = { stepId: 'next', buttonText: null };

function makeTask(
  overrides: Partial<ServerWorkflowTask> & {
    taskType?: ServerTaskTypeEnum | string;
  } = {},
): ServerWorkflowTask {
  return {
    type: ServerStepTypeEnum.Task,
    taskType: ServerTaskTypeEnum.GetData,
    title: 'Test task',
    prompt: 'Do something',
    executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
    automaticCompletion: false,
    outgoing: [defaultTransition],
    ...overrides,
  } as ServerWorkflowTask;
}

function makeCondition(
  outgoing: ServerWorkflowCondition['outgoing'],
  overrides: Partial<ServerWorkflowCondition> = {},
): ServerWorkflowCondition {
  return {
    type: ServerStepTypeEnum.Condition,
    title: 'Test condition',
    prompt: 'Choose one',
    executionType: ServerStepExecutionTypeEnum.FullyAutomated,
    automaticCompletion: false,
    outgoing,
    ...overrides,
  };
}

describe('toStepDefinition', () => {
  describe('task mapping', () => {
    it('should map task with get-data taskType to read-record', () => {
      const task = makeTask({ taskType: ServerTaskTypeEnum.GetData, prompt: 'read it' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.ReadRecord,
        prompt: 'read it',
        title: 'Test task',
        executionType: ServerStepExecutionTypeEnum.FullyAutomated,
      });
    });

    it('should map task with update-data taskType to update-record', () => {
      const task = makeTask({ taskType: ServerTaskTypeEnum.UpdateData, prompt: 'update it' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.UpdateRecord,
        prompt: 'update it',
        title: 'Test task',
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
      });
    });

    it('should map task with trigger-action taskType to trigger-action', () => {
      const task = makeTask({ taskType: ServerTaskTypeEnum.TriggerAction, prompt: 'trigger it' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.TriggerAction,
        prompt: 'trigger it',
        title: 'Test task',
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
      });
    });

    it('should map task with load-related-record taskType to load-related-record', () => {
      const task = makeTask({
        taskType: ServerTaskTypeEnum.LoadRelatedRecord,
        prompt: 'load it',
      });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.LoadRelatedRecord,
        prompt: 'load it',
        title: 'Test task',
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
      });
    });

    it('should map task with mcp-server taskType to mcp and include mcpServerId', () => {
      const task = makeTask({
        taskType: ServerTaskTypeEnum.McpServer,
        prompt: 'run mcp',
        mcpServerId: 'mcp-abc',
      });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.Mcp,
        prompt: 'run mcp',
        mcpServerId: 'mcp-abc',
        title: 'Test task',
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
      });
    });

    it('rejects an mcp-server task missing mcpServerId at the zod boundary', () => {
      const task = makeTask({ taskType: ServerTaskTypeEnum.McpServer, prompt: 'run mcp' });

      expect(() => toStepDefinition(task)).toThrow();
    });

    it('should map task with guideline taskType to guidance', () => {
      const task = makeTask({
        taskType: ServerTaskTypeEnum.Guideline,
        prompt: 'guide them',
        executionType: ServerStepExecutionTypeEnum.Manual,
      });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.Guidance,
        prompt: 'guide them',
        title: 'Test task',
        executionType: StepExecutionMode.Manual,
      });
    });

    it('should preserve executionType=fully-automated', () => {
      const task = makeTask({
        taskType: ServerTaskTypeEnum.GetData,
        executionType: ServerStepExecutionTypeEnum.FullyAutomated,
      });

      expect(toStepDefinition(task)).toMatchObject({
        executionType: ServerStepExecutionTypeEnum.FullyAutomated,
      });
    });

    it('should preserve executionType=automated-with-confirmation', () => {
      const task = makeTask({
        taskType: ServerTaskTypeEnum.UpdateData,
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
      });

      expect(toStepDefinition(task)).toMatchObject({
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
      });
    });

    // Casts through `as` because the orchestrator types forbid this combination — the runtime
    // normalization is a defensive safety net for wire data the server should not emit.
    it('should silently fall back to default when executionType is unsupported for the step type', () => {
      const task = makeTask({
        taskType: ServerTaskTypeEnum.GetData,
        executionType:
          ServerStepExecutionTypeEnum.Manual as ServerStepExecutionTypeEnum.FullyAutomated,
      });

      expect(toStepDefinition(task)).toMatchObject({
        executionType: StepExecutionMode.FullyAutomated,
      });
    });

    it('should fallback to default executionType when undefined on the server step', () => {
      // Strip executionType so the mapper does not forward it (real-world legacy step).
      const task = makeTask({ taskType: ServerTaskTypeEnum.GetData });
      delete (task as { executionType?: unknown }).executionType;

      expect(toStepDefinition(task)).toMatchObject({
        executionType: StepExecutionMode.FullyAutomated,
      });
    });

    it('should throw InvalidStepDefinitionError for unknown taskType', () => {
      const task = makeTask({ taskType: 'unknown-task' as ServerTaskTypeEnum });

      expect(() => toStepDefinition(task)).toThrow(InvalidStepDefinitionError);
      expect(() => toStepDefinition(task)).toThrow('Unknown taskType: "unknown-task"');
    });
  });

  describe('condition mapping', () => {
    it('should map condition with answer transitions to options', () => {
      const condition = makeCondition([
        { stepId: 's1', buttonText: null, answer: 'Yes' },
        { stepId: 's2', buttonText: null, answer: 'No' },
      ]);

      expect(toStepDefinition(condition)).toEqual({
        type: StepType.Condition,
        prompt: 'Choose one',
        title: 'Test condition',
        options: ['Yes', 'No'],
        executionType: StepExecutionMode.FullyAutomated,
      });
    });

    it('should fall back to buttonText when answer is absent', () => {
      const condition = makeCondition([
        { stepId: 's1', buttonText: 'Approve' },
        { stepId: 's2', buttonText: 'Reject' },
      ]);

      expect(toStepDefinition(condition)).toEqual({
        type: StepType.Condition,
        prompt: 'Choose one',
        title: 'Test condition',
        options: ['Approve', 'Reject'],
        executionType: StepExecutionMode.FullyAutomated,
      });
    });

    it('should prefer answer over buttonText when both are present', () => {
      const condition = makeCondition([
        { stepId: 's1', buttonText: 'Btn1', answer: 'Answer1' },
        { stepId: 's2', buttonText: 'Btn2', answer: 'Answer2' },
      ]);

      expect(toStepDefinition(condition)).toMatchObject({
        options: ['Answer1', 'Answer2'],
      });
    });

    it('should preserve executionType=manual on condition steps', () => {
      const condition = makeCondition(
        [
          { stepId: 's1', buttonText: null, answer: 'Yes' },
          { stepId: 's2', buttonText: null, answer: 'No' },
        ],
        { executionType: ServerStepExecutionTypeEnum.Manual },
      );

      expect(toStepDefinition(condition)).toMatchObject({
        executionType: ServerStepExecutionTypeEnum.Manual,
      });
    });

    it('should throw InvalidStepDefinitionError when fewer than 2 options', () => {
      const condition = makeCondition([{ stepId: 's1', buttonText: 'Only' }]);

      expect(() => toStepDefinition(condition)).toThrow(InvalidStepDefinitionError);
      expect(() => toStepDefinition(condition)).toThrow(
        'Condition step requires at least 2 options, got 1',
      );
    });

    it('should throw InvalidStepDefinitionError when outgoing is empty', () => {
      const condition = makeCondition([]);

      expect(() => toStepDefinition(condition)).toThrow(InvalidStepDefinitionError);
    });

    it('should filter out transitions with no answer and no buttonText', () => {
      const condition = makeCondition([
        { stepId: 's1', buttonText: null },
        { stepId: 's2', buttonText: 'Valid' },
        { stepId: 's3', buttonText: null, answer: 'AlsoValid' },
      ]);

      expect(toStepDefinition(condition)).toMatchObject({
        options: ['Valid', 'AlsoValid'],
      });
    });
  });

  describe('unsupported step types', () => {
    it('should throw UnsupportedStepTypeError for end', () => {
      const step: ServerWorkflowEnd = {
        type: ServerStepTypeEnum.End,
        title: 'End',
        prompt: 'Done',
        executionType: ServerStepExecutionTypeEnum.Manual,
        automaticCompletion: false,
        outgoing: [],
      };

      expect(() => toStepDefinition(step)).toThrow(UnsupportedStepTypeError);
      expect(() => toStepDefinition(step)).toThrow(
        'Step type "end" is not supported by the executor',
      );
    });

    it('should throw UnsupportedStepTypeError for escalation', () => {
      const step: ServerWorkflowEscalation = {
        type: ServerStepTypeEnum.Escalation,
        title: 'Escalate',
        prompt: 'To whom',
        executionType: ServerStepExecutionTypeEnum.AutomatedWithConfirmation,
        automaticCompletion: false,
        outgoing: [defaultTransition],
        inboxId: null,
      };

      expect(() => toStepDefinition(step)).toThrow(UnsupportedStepTypeError);
    });

    it('should throw UnsupportedStepTypeError for start-sub-workflow', () => {
      const step: ServerStartSubWorkflow = {
        type: ServerStepTypeEnum.StartSubWorkflow,
        title: 'Start sub',
        prompt: 'Run sub',
        executionType: ServerStepExecutionTypeEnum.Manual,
        automaticCompletion: false,
        outgoing: [defaultTransition],
        workflowId: 'sub-wf',
      };

      expect(() => toStepDefinition(step)).toThrow(UnsupportedStepTypeError);
    });

    it('should throw UnsupportedStepTypeError for close-sub-workflow', () => {
      const step: ServerCloseSubWorkflow = {
        type: ServerStepTypeEnum.CloseSubWorkflow,
        title: 'Close sub',
        executionType: ServerStepExecutionTypeEnum.Manual,
        automaticCompletion: false,
        outgoing: [defaultTransition],
        parentWorkflowId: null,
      };

      expect(() => toStepDefinition(step)).toThrow(UnsupportedStepTypeError);
    });
  });

  describe('unknown step types', () => {
    it('should throw InvalidStepDefinitionError for unknown type', () => {
      const step = { type: 'mystery', title: 'x' } as unknown as ServerWorkflowStep;

      expect(() => toStepDefinition(step)).toThrow(InvalidStepDefinitionError);
      expect(() => toStepDefinition(step)).toThrow('Unknown server step type: "mystery"');
    });
  });
});
