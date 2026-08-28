import type { AgentActionClient } from '../../src/action/agent-action-client';
import type { Logger } from '../../src/ports/logger-port';

import request from 'supertest';

import { buildApp, clientOf, makeAction, readModel, storeOf } from '../helpers/action-routes';

function execApp(client: AgentActionClient, logger?: Logger) {
  return buildApp(storeOf(readModel), client, logger ? { logger } : {});
}

describe('execute input validation', () => {
  it('rejects a missing required field with 400 missing_required_fields before executing', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        { name: 'reason', type: 'String', value: null, isRequired: true },
        { name: 'tier', type: 'String', value: null, isRequired: true },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: {} });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      type: 'missing_required_fields',
      status: 400,
      message: 'Required action fields are missing: reason, tier',
      details: { fields: ['reason', 'tier'] },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes when the submitted value satisfies the required field', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        { name: 'reason', type: 'String', value: null, isRequired: true },
        // 0 and false count as present values, exactly like the form endpoint's requiredFields.
        { name: 'amount', type: 'Number', value: null, isRequired: true },
        { name: 'confirm', type: 'Boolean', value: null, isRequired: true },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { reason: 'because', amount: 0, confirm: false } });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('executes when a required field is satisfied by a loaded default, not a submission', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [{ name: 'reason', type: 'String', value: 'preset', isRequired: true }],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: {} });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('validates the form as rebuilt by a change hook, not the loaded one', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    // The loaded form requires nothing; the hook that runs on setFields makes "late" required.
    const form = makeAction({
      fields: [{ name: 'reason', type: 'String', value: null, isRequired: false }],
      postSet: { fields: [{ name: 'late', type: 'String', value: null, isRequired: true }] },
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { reason: 'x' } });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      type: 'missing_required_fields',
      details: { fields: ['late'] },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects an out-of-enum value with 422 invalid_action_value before executing', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        {
          name: 'tier',
          type: 'Enum',
          value: null,
          isRequired: false,
          enumValues: ['gold', 'silver'],
        },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { tier: 'NOPE' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toEqual({
      type: 'invalid_action_value',
      status: 422,
      message: 'Invalid action field values: tier (expected one of: gold, silver)',
      details: { fields: [{ field: 'tier', expected: 'one of: gold, silver' }] },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes an in-options enum value, a number on a Number field, and an enum without options', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        { name: 'tier', type: 'Enum', value: null, isRequired: false, enumValues: ['gold'] },
        // An agent can declare an Enum with no options: the field then accepts any string.
        { name: 'free', type: 'Enum', value: null, isRequired: false, enumValues: [] },
        { name: 'amount', type: 'Number', value: null, isRequired: false },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { tier: 'gold', free: 'anything', amount: 5 } });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a null item inside a constrained list before executing', async () => {
    const makeListForm = (values: Record<string, unknown>) => {
      const execute = jest.fn(async () => ({ success: 'Done' }));

      return {
        execute,
        response: request(
          execApp(
            clientOf(
              makeAction({
                fields: [
                  {
                    name: 'tags',
                    type: ['Enum'],
                    value: null,
                    isRequired: false,
                    enumValues: ['a'],
                  },
                  { name: 'ids', type: ['Number'], value: null, isRequired: false },
                ],
                execute,
              }),
            ),
          ).callback(),
        )
          .post('/agent/v1/users/actions/approve/execute')
          .send({ recordIds: ['42'], values }),
      };
    };

    const enumResult = await makeListForm({ tags: ['a', null] }).response;
    expect(enumResult.status).toBe(422);
    expect(enumResult.body.error).toMatchObject({
      type: 'invalid_action_value',
      details: { fields: [{ field: 'tags', expected: 'one of: a' }] },
    });

    const numberResult = await makeListForm({ ids: [1, null] }).response;
    expect(numberResult.status).toBe(422);
    expect(numberResult.body.error).toMatchObject({
      type: 'invalid_action_value',
      details: { fields: [{ field: 'ids', expected: 'a number' }] },
    });
  });

  it('rejects a form-urlencoded execute body: it cannot carry the nested recordIds and values', async () => {
    // A urlencoded form flattens bracket notation instead of nesting it, so recordIds never
    // arrives as an array and the request fails at the shape check, before value validation.
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [{ name: 'amount', type: 'Number', value: null, isRequired: false }],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .type('form')
      .send({ recordIds: ['42'], values: { amount: '5' } });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['a string sent to a Number field', 'amount', 'Number', 'nan', 'a number'],
    ['a string sent to a Boolean field', 'flag', 'Boolean', 'true', 'a boolean'],
    ['a number sent to a String field', 'reason', 'String', 42, 'a string'],
  ])('rejects %s with 422 naming the expectation', async (_label, name, type, value, expected) => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [{ name, type, value: null, isRequired: false }],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { [name]: value } });

    expect(response.status).toBe(422);
    expect(response.body.error).toEqual({
      type: 'invalid_action_value',
      status: 422,
      message: `Invalid action field values: ${name} (expected ${expected})`,
      details: { fields: [{ field: name, expected }] },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a non-array sent to a list field and an out-of-options list item', async () => {
    const makeListForm = () => {
      const execute = jest.fn(async () => ({ success: 'Done' }));

      return {
        execute,
        form: makeAction({
          fields: [
            { name: 'ids', type: ['Number'], value: null, isRequired: false },
            {
              name: 'tags',
              type: ['Enum'],
              value: null,
              isRequired: false,
              enumValues: ['a', 'b'],
            },
          ],
          execute,
        }),
      };
    };

    // Each request loads a fresh Action from the agent, so the two cases get separate forms.
    const firstCase = makeListForm();
    const first = await request(execApp(clientOf(firstCase.form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { ids: 'nope' } });

    expect(first.status).toBe(422);
    expect(first.body.error).toMatchObject({
      type: 'invalid_action_value',
      details: { fields: [{ field: 'ids', expected: 'an array of a number' }] },
    });

    const secondCase = makeListForm();
    const second = await request(execApp(clientOf(secondCase.form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { tags: ['a', 'zzz'] } });

    expect(second.status).toBe(422);
    expect(second.body.error).toMatchObject({
      type: 'invalid_action_value',
      details: { fields: [{ field: 'tags', expected: 'one of: a, b' }] },
    });
    expect(firstCase.execute).not.toHaveBeenCalled();
    expect(secondCase.execute).not.toHaveBeenCalled();
  });

  it('executes a fully valid list submission', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        { name: 'ids', type: ['Number'], value: null, isRequired: false },
        {
          name: 'tags',
          type: ['Enum'],
          value: null,
          isRequired: false,
          enumValues: ['a', 'b'],
        },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { ids: [1, 2], tags: ['a', 'b'] } });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrongly typed item in a legacy NumberList field', async () => {
    // Some agents emit list types under their collapsed legacy names; agent-client's
    // Action.getField dispatches on both forms, so the validator must too.
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [{ name: 'ids', type: 'NumberList', value: null, isRequired: false }],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { ids: [1, 'two'] } });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      type: 'invalid_action_value',
      details: { fields: [{ field: 'ids', expected: 'a number' }] },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('checks a legacy EnumList field against its options and executes a valid one', async () => {
    const makeForm = () => {
      const execute = jest.fn(async () => ({ success: 'Done' }));

      return {
        execute,
        form: makeAction({
          fields: [
            {
              name: 'tags',
              type: 'EnumList',
              value: null,
              isRequired: false,
              enumValues: ['a', 'b'],
            },
          ],
          execute,
        }),
      };
    };

    const bad = makeForm();
    const rejected = await request(execApp(clientOf(bad.form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { tags: ['a', 'zzz'] } });

    expect(rejected.status).toBe(422);
    expect(rejected.body.error).toMatchObject({
      type: 'invalid_action_value',
      details: { fields: [{ field: 'tags', expected: 'one of: a, b' }] },
    });
    expect(bad.execute).not.toHaveBeenCalled();

    const good = makeForm();
    const accepted = await request(execApp(clientOf(good.form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { tags: ['a', 'b'] } });

    expect(accepted.status).toBe(200);
    expect(good.execute).toHaveBeenCalledTimes(1);
  });

  it('does not type-check Json or File fields at the BFF', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        { name: 'meta', type: 'Json', value: null, isRequired: false },
        { name: 'doc', type: 'File', value: null, isRequired: false },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({
        recordIds: ['42'],
        values: { meta: { any: [1, null] }, doc: 'data:text/plain;aGk=' },
      });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('accepts a packed id string on a record-picker field whose PK type is Number', async () => {
    // The agent rewrites a Collection field to its target PK column type, but execute unpacks
    // packed id STRINGS only (IdUtils.unpackId throws on a number): the published type is not
    // the runtime contract, and the string is the only shape that may execute.
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        {
          name: 'assignee',
          type: 'Number',
          value: null,
          isRequired: false,
          reference: 'users.id',
        },
      ],
      execute,
    });

    const ok = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { assignee: '42' } });

    expect(ok.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects a raw number on a record-picker field with the packed id expectation', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        {
          name: 'assignee',
          type: 'Number',
          value: null,
          isRequired: false,
          reference: 'users.id',
        },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { assignee: 42 } });

    expect(response.status).toBe(422);
    expect(response.body.error).toEqual({
      type: 'invalid_action_value',
      status: 422,
      message:
        'Invalid action field values: assignee (expected a string holding a packed record id)',
      details: {
        fields: [{ field: 'assignee', expected: 'a string holding a packed record id' }],
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('ignores a leftover enums array on a typed field and a malformed options array', async () => {
    const execute = jest.fn(async () => ({ success: 'Done' }));
    const form = makeAction({
      fields: [
        // A hook can rebuild a form leaving enums on a field whose type is not Enum: membership
        // applies to Enum fields only. `enums` arrives malformed (a bare string) on the other.
        {
          name: 'amount',
          type: 'Number',
          value: null,
          isRequired: false,
          enumValues: ['gold', 'silver'],
        },
        {
          name: 'tier',
          type: 'Enum',
          value: null,
          isRequired: false,
          enumValues: 'gold' as unknown as string[],
        },
      ],
      execute,
    });

    const response = await request(execApp(clientOf(form)).callback())
      .post('/agent/v1/users/actions/approve/execute')
      .send({ recordIds: ['42'], values: { amount: 5, tier: 'whatever' } });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
