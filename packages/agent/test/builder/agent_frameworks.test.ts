/* eslint-disable max-classes-per-file */
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import Fastify2 from 'fastify2';
import Fastify3 from 'fastify';
import Koa from 'koa';
import express from 'express';
import superagent from 'superagent';

import * as factories from '../agent/__factories__';
import Agent from '../../src/builder/agent';
import HealthCheck from '../../src/agent/routes/system/healthcheck';

const mockMakeRoutes = jest.fn().mockReturnValue([new HealthCheck(null, null)]);

jest.mock('../../src/agent/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

describe('Builder > Agent', () => {
  it('should return an error when not started', async () => {
    expect.assertions(1);

    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options).mountOnStandaloneServer(9997, 'localhost');

    try {
      const response = await superagent.get('http://localhost:9997/forest');
      expect(response.body).toStrictEqual({ error: 'Agent is not started' });
    } finally {
      await agent.stop();
    }
  });

  it('should work in standalone mode', async () => {
    expect.assertions(1);

    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options).mountOnStandaloneServer(9997, 'localhost');

    try {
      await agent.start();

      const response = await superagent.get('http://localhost:9997/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      await agent.stop();
    }
  });

  it('should work in an express app', async () => {
    const app = express();

    const options = factories.forestAdminHttpDriverOptions.build();

    const agent = new Agent(options).mountOnExpress(app);
    await agent.start();

    const server = app.listen(9998);

    try {
      const response = await superagent.get('http://localhost:9998/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      server.close();
    }
  });

  it('should work in an koa app', async () => {
    const app = new Koa();

    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options).mountOnKoa(app);
    await agent.start();

    const server = app.listen(9998);

    try {
      const response = await superagent.get('http://localhost:9998/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      server.close();
    }
  });

  it.each([
    ['v2', Fastify2],
    ['v3', Fastify3],
  ])('should work in a fastify %s app', async (_, Fastify) => {
    const app = (Fastify as Function)(); // eslint-disable-line @typescript-eslint/ban-types

    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options).mountOnFastify(app);
    await agent.start();

    await app.listen(9999);

    try {
      const response = await superagent.get('http://localhost:9999/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      app.close();
    }
  });

  it('should work in NestJS/Express', async () => {
    @Module({ imports: [], controllers: [], providers: [] })
    class AppModule {}
    const app = await NestFactory.create(AppModule, { logger: false });

    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options).mountOnNestJs(app);
    await agent.start();

    await app.listen(9996);

    try {
      const response = await superagent.get('http://localhost:9996/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      await app.close();
    }
  });

  it('should work in NestJS/Fastify', async () => {
    @Module({ imports: [], controllers: [], providers: [] })
    class AppModule {}
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });

    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options).mountOnNestJs(app);
    await agent.start();

    await app.listen(9995);

    try {
      const response = await superagent.get('http://localhost:9995/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      await app.close();
    }
  });
});
