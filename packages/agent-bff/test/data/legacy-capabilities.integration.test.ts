import type { LegacyAgent } from './fixtures/legacy-agent-harness';
import type Koa from 'koa';

import request from 'supertest';

import { buildLegacyApp, startLegacyAgent } from './fixtures/legacy-agent-harness';

// Every assertion here goes through the real synthesizer: the agent serves a 404 on the capabilities
// route, so the fields come from the apimap the harness publishes, not from a hand-written object.
describe('constrained reads in front of an agent with no capabilities route', () => {
  let agent: LegacyAgent;
  let app: Koa;

  beforeAll(async () => {
    agent = await startLegacyAgent();
    app = buildLegacyApp(agent.url, { liana: 'forest-rails' });
  });

  afterAll(async () => {
    await agent?.stop();
  });

  it('should serve a sort on a sortable column, and pass the ordering to the agent', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ sort: [{ field: 'title', direction: 'desc' }] });

    expect(response.status).toBe(200);

    const listCall = agent.seen.filter(entry => entry.path === '/forest/Article').pop();
    expect(listCall?.query.get('sort')).toBe('-title');
  });

  it('should serve a projection, and pass the requested fields to the agent', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ projection: ['id', 'title'] });

    expect(response.status).toBe(200);

    const listCall = agent.seen.filter(entry => entry.path === '/forest/Article').pop();
    expect(listCall?.query.get('fields[Article]')).toBe('id,title');
  });

  it('should serve a filter and send the operator in the legacy snake_case the liana parses', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ filter: { field: 'title', operator: 'StartsWith', value: 'A' } });

    expect(response.status).toBe(200);

    const listCall = agent.seen.filter(entry => entry.path === '/forest/Article').pop();
    expect(JSON.parse(listCall?.query.get('filters') ?? '{}')).toEqual({
      field: 'title',
      operator: 'starts_with',
      value: 'A',
    });
  });

  it('should reject a filter on a field the apimap marks not filterable', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ filter: { field: 'computed', operator: 'Equal', value: 'x' } });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      type: 'field_not_filterable',
      details: { field: 'computed' },
    });
  });

  it('should reject an operator the liana cannot honour, naming the ones it can', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ filter: { field: 'title', operator: 'Like', value: 'A%' } });

    expect(response.status).toBe(400);
    expect(response.body.error.type).toBe('invalid_filter_operator');
    expect(response.body.error.details.validOperators).toContain('StartsWith');
    expect(response.body.error.details.validOperators).not.toContain('Like');
  });

  it('should reject a sort on a field the apimap marks not sortable, instead of letting SQL fail', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ sort: [{ field: 'computed' }] });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({
      type: 'field_not_sortable',
      details: { field: 'computed' },
    });
  });

  it('should classify the two relation kinds as v2 does', async () => {
    const toOne = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ filter: { field: 'author', operator: 'Equal', value: 1 } });
    const toMany = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ filter: { field: 'comments', operator: 'Equal', value: 1 } });

    expect(toOne.body.error).toMatchObject({ type: 'field_not_filterable' });
    expect(toMany.body.error).toMatchObject({ type: 'unknown_field' });
  });

  // Its own app, so the count is a delta over a cold capabilities cache: asserting an absolute
  // would only hold when the tests above have already warmed the shared one.
  it('should ask the agent for capabilities once per cache, not on every constrained request', async () => {
    const coldApp = buildLegacyApp(agent.url, { liana: 'forest-rails' });
    const before = agent.capabilitiesCalls();

    await request(coldApp.callback())
      .post('/agent/v1/Article/list')
      .send({ sort: [{ field: 'id' }] });
    await request(coldApp.callback())
      .post('/agent/v1/Article/list')
      .send({ sort: [{ field: 'id' }] });

    expect(agent.capabilitiesCalls() - before).toBe(1);
  });

  it('should never put the agent HTML error page in a response body', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ sort: [{ field: 'title' }] });

    expect(JSON.stringify(response.body)).not.toContain('<!DOCTYPE');
  });
});

describe('the same reads when the schema was not published by a legacy liana', () => {
  let agent: LegacyAgent;
  let app: Koa;

  beforeAll(async () => {
    agent = await startLegacyAgent();
    app = buildLegacyApp(agent.url, { liana: 'forest-nodejs-agent' });
  });

  afterAll(async () => {
    await agent?.stop();
  });

  it('should fail the constrained read, but without leaking the agent HTML', async () => {
    const response = await request(app.callback())
      .post('/agent/v1/Article/list')
      .send({ sort: [{ field: 'title' }] });

    expect(response.status).toBe(404);
    expect(response.body.error.type).toBe('not_found');
    expect(JSON.stringify(response.body)).not.toContain('<!DOCTYPE');
  });

  it('should still serve a bare read, which needs no capabilities', async () => {
    const response = await request(app.callback()).post('/agent/v1/Article/list').send({});

    expect(response.status).toBe(200);
  });
});
