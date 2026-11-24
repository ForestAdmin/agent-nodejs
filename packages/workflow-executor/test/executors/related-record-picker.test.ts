import type { PickerAi } from '../../src/executors/related-record-picker';
import type { RecordData } from '../../src/types/validated/collection';

import { SystemMessage } from '@forestadmin/ai-proxy';

import { InvalidAIResponseError } from '../../src/errors';
import { selectRelevantRecordIndexes } from '../../src/executors/related-record-picker';

function candidate(id: number, name = `store ${id}`): RecordData {
  return { collectionName: 'stores', recordId: [id], values: { name } };
}

function aiAnswering(answer: unknown): PickerAi {
  return {
    invoke: jest.fn().mockResolvedValue(answer),
    contextMessage: new SystemMessage('context'),
    warn: jest.fn(),
  } as unknown as PickerAi;
}

const pick = (answer: unknown, candidates = [candidate(1), candidate(2), candidate(3)]) =>
  selectRelevantRecordIndexes(aiAnswering(answer), candidates, ['name'], 'stores', 'Stores');

describe('selectRelevantRecordIndexes', () => {
  it('keeps each index once, in the order the AI first named it', async () => {
    const { indexes } = await pick({ recordIndexes: [1, 1, 0], confident: true });

    expect(indexes).toStrictEqual([1, 0]);
  });

  it('counts a pick with no confidence flag as sure', async () => {
    const { confident } = await pick({ recordIndexes: [0] });

    expect(confident).toBe(true);
  });

  it('counts a pick flagged not confident as unsure', async () => {
    const { confident } = await pick({ recordIndexes: [0], confident: false });

    expect(confident).toBe(false);
  });

  it.each([[-1], [1.5], [null]])('refuses the index %p', async index => {
    await expect(pick({ recordIndexes: [index], confident: true })).rejects.toThrow(
      InvalidAIResponseError,
    );
  });

  it('refuses an index past the candidates shown when the prompt was cut short', async () => {
    const longName = 'x'.repeat(80);
    const candidates = Array.from({ length: 400 }, (_, i) => candidate(i, longName));

    const shown = await pick({ recordIndexes: [0], confident: true }, candidates);
    expect(shown.sawAll).toBe(false);

    await expect(pick({ recordIndexes: [399], confident: true }, candidates)).rejects.toThrow(
      InvalidAIResponseError,
    );
  });
});
