/* eslint-disable max-classes-per-file */
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import Fastify2 from 'fastify2';
import Fastify3 from 'fastify';
import Koa from 'koa';
import Router from '@koa/router';
import express from 'express';
import superagent from 'superagent';

import FrameworkMounter from '../../src/builder/framework-mounter';

const logger: Logger = () => {};

const router = new Router().get('/', async ctx => {
  ctx.response.body = { error: null, message: 'Agent is running' };
});

describe('Builder > Agent', () => {
  it('should return an error when not started', async () => {
    expect.assertions(1);

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnStandaloneServer(9994, 'localhost');

    try {
      const response = await superagent.get('http://localhost:9994/my-api/forest');
      expect(response.body).toStrictEqual({ error: 'Agent is not started' });
    } finally {
      await mounter.stop();
    }
  });

  it('should work in standalone mode', async () => {
    expect.assertions(1);

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnStandaloneServer(9997, 'localhost');

    try {
      await mounter.start(router);

      const response = await superagent.get('http://localhost:9997/my-api/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      await mounter.stop();
    }
  });

  it('should work in an express app', async () => {
    const app = express();

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnExpress(app);
    await mounter.start(router);

    const server = app.listen(9998);

    try {
      const response = await superagent.get('http://localhost:9998/my-api/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      server.close();
    }
  });

  it('should work in an koa app', async () => {
    const app = new Koa();

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnKoa(app);
    await mounter.start(router);

    const server = app.listen(9998);

    try {
      const response = await superagent.get('http://localhost:9998/my-api/forest');
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

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnFastify(app);
    await mounter.start(router);

    await app.listen(9999);

    try {
      const response = await superagent.get('http://localhost:9999/my-api/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      app.close();
    }
  });

  it('should work in NestJS/Express', async () => {
    @Module({ imports: [], controllers: [], providers: [] })
    class AppModule {}
    const app = await NestFactory.create(AppModule, { logger: false });

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnNestJs(app);
    await mounter.start(router);

    await app.listen(9996);

    try {
      const response = await superagent.get('http://localhost:9996/my-api/forest');
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

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnNestJs(app);
    await mounter.start(router);

    await app.listen(9995);

    try {
      const response = await superagent.get('http://localhost:9995/my-api/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      await app.close();
    }
  });
});
