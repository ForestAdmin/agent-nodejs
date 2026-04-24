import type {
  ServerCloseSubWorkflow,
  ServerStartSubWorkflow,
  ServerWorkflowCondition,
  ServerWorkflowEnd,
  ServerWorkflowEscalation,
  ServerWorkflowStep,
  ServerWorkflowTask,
} from '../../src/adapters/server-types';

import toStepDefinition from '../../src/adapters/step-definition-mapper';
import { InvalidStepDefinitionError, UnsupportedStepTypeError } from '../../src/errors';
import { StepType } from '../../src/types/validated/step-definition';

function makeTask(overrides: Partial<ServerWorkflowTask> = {}): ServerWorkflowTask {
  return {
    type: 'task',
    taskType: 'get-data',
    title: 'Test task',
    prompt: 'Do something',
    outgoing: { stepId: 'next', buttonText: null },
    ...overrides,
  };
}

function makeCondition(
  outgoing: ServerWorkflowCondition['outgoing'],
  overrides: Partial<ServerWorkflowCondition> = {},
): ServerWorkflowCondition {
  return {
    type: 'condition',
    title: 'Test condition',
    prompt: 'Choose one',
    outgoing,
    ...overrides,
  };
}

describe('toStepDefinition', () => {
  describe('task mapping', () => {
    it('should map task with get-data taskType to read-record', () => {
      const task = makeTask({ taskType: 'get-data', prompt: 'read it' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.ReadRecord,
        prompt: 'read it',
      });
    });

    it('should map task with update-data taskType to update-record', () => {
      const task = makeTask({ taskType: 'update-data', prompt: 'update it' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.UpdateRecord,
        prompt: 'update it',
      });
    });

    it('should map task with trigger-action taskType to trigger-action', () => {
      const task = makeTask({ taskType: 'trigger-action', prompt: 'trigger it' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.TriggerAction,
        prompt: 'trigger it',
      });
    });

    it('should map task with load-related-record taskType to load-related-record', () => {
      const task = makeTask({ taskType: 'load-related-record', prompt: 'load it' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.LoadRelatedRecord,
        prompt: 'load it',
      });
    });

    it('should map task with mcp-server taskType to mcp and include mcpServerId', () => {
      const task = makeTask({
        taskType: 'mcp-server',
        prompt: 'run mcp',
        mcpServerId: 'mcp-abc',
      });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.Mcp,
        prompt: 'run mcp',
        mcpServerId: 'mcp-abc',
      });
    });

    it('should map task with mcp-server taskType without mcpServerId', () => {
      const task = makeTask({ taskType: 'mcp-server', prompt: 'run mcp' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.Mcp,
        prompt: 'run mcp',
      });
    });

    it('should map task with guideline taskType to guidance', () => {
      const task = makeTask({ taskType: 'guideline', prompt: 'guide them' });

      expect(toStepDefinition(task)).toEqual({
        type: StepType.Guidance,
        prompt: 'guide them',
      });
    });

    it('should preserve automaticExecution when true', () => {
      const task = makeTask({ taskType: 'get-data', automaticExecution: true });

      expect(toStepDefinition(task)).toMatchObject({ automaticExecution: true });
    });

    it('should preserve automaticExecution when false', () => {
      const task = makeTask({ taskType: 'get-data', automaticExecution: false });

      expect(toStepDefinition(task)).toMatchObject({ automaticExecution: false });
    });

    it('should omit automaticExecution when undefined on the server step', () => {
      const task = makeTask({ taskType: 'get-data' });

      expect(toStepDefinition(task)).not.toHaveProperty('automaticExecution');
    });

    it('should throw InvalidStepDefinitionError for unknown taskType', () => {
      const task = makeTask({ taskType: 'unknown-task' as ServerWorkflowTask['taskType'] });

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
        options: ['Yes', 'No'],
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
        options: ['Approve', 'Reject'],
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
      const step: ServerWorkflowEnd = { type: 'end', title: 'End', prompt: 'Done' };

      expect(() => toStepDefinition(step)).toThrow(UnsupportedStepTypeError);
      expect(() => toStepDefinition(step)).toThrow(
        'Step type "end" is not supported by the executor',
      );
    });

    it('should throw UnsupportedStepTypeError for escalation', () => {
      const step: ServerWorkflowEscalation = {
        type: 'escalation',
        title: 'Escalate',
        prompt: 'To whom',
        outgoing: { stepId: 'next', buttonText: null },
        inboxId: null,
      };

      expect(() => toStepDefinition(step)).toThrow(UnsupportedStepTypeError);
    });

    it('should throw UnsupportedStepTypeError for start-sub-workflow', () => {
      const step: ServerStartSubWorkflow = {
        type: 'start-sub-workflow',
        title: 'Start sub',
        prompt: 'Run sub',
        outgoing: { stepId: 'next', buttonText: null },
        workflowId: 'sub-wf',
      };

      expect(() => toStepDefinition(step)).toThrow(UnsupportedStepTypeError);
    });

    it('should throw UnsupportedStepTypeError for close-sub-workflow', () => {
      const step: ServerCloseSubWorkflow = {
        type: 'close-sub-workflow',
        outgoing: { stepId: 'next', buttonText: null },
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
