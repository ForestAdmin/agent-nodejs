/* eslint-disable max-classes-per-file */
import { Logger } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import express from 'express';
import Fastify3 from 'fastify';
import Fastify2 from 'fastify2';
import Koa from 'koa';
import superagent from 'superagent';

import FrameworkMounter from '../src/framework-mounter';

const logger: Logger = () => {};

const router = new Router().get('/', async ctx => {
  ctx.response.body = { error: null, message: 'Agent is running' };
});

const newRouter = new Router().get('/resource', async ctx => {
  ctx.response.body = { message: 'Here is your resource' };
});

describe('Builder > Agent', () => {
  describe('standalone mode', () => {
    describe('when starting the agent is a success', () => {
      it('should send a response', async () => {
        const mounter = new FrameworkMounter('my-api', logger);
        mounter.mountOnStandaloneServer(9997, 'localhost');

        try {
          // @ts-expect-error: testing a protected method
          await mounter.mount(router);

          const response = await superagent.get('http://localhost:9997/my-api/forest');
          expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
        } finally {
          await mounter.stop();
        }
      });
    });

    describe('when the agent is not started', () => {
      it('should throw an error', async () => {
        const mounter = new FrameworkMounter('my-api', logger);
        mounter.mountOnStandaloneServer(9994, 'localhost');

        await expect(() =>
          superagent.get('http://localhost:9994/my-api/forest').timeout(100),
        ).rejects.toThrow();
      });

      it('should not throw an error to call stop', async () => {
        expect.assertions(0);
        const mounter = new FrameworkMounter('my-api', logger);
        mounter.mountOnStandaloneServer(9994, 'localhost');

        await mounter.stop();
      });
    });

    describe('when starting the agent fails', () => {
      it('should throw an error catchable', async () => {
        const mounter = new FrameworkMounter('my-api', logger);
        const mounter2 = new FrameworkMounter('my-api', logger);

        try {
          await expect(async () => {
            mounter.mountOnStandaloneServer(9997, 'localhost');
            // @ts-expect-error: testing a protected method
            await mounter.mount(router);
            // throw error on start by mount two servers on the same port
            mounter2.mountOnStandaloneServer(9997, 'localhost');
            // @ts-expect-error: testing a protected method
            await mounter2.mount(router);
          }).rejects.toThrow('9997');
        } finally {
          await mounter.stop();
          await mounter2.stop();
        }
      });
    });
  });

  describe('when agent is mounted without the standalone mode or koa', () => {
    describe('when the agent is not started', () => {
      it('should return a default response "Agent is not started"', async () => {
        expect.assertions(1);
        const app = express();

        const mounter = new FrameworkMounter('my-api', logger);
        mounter.mountOnExpress(app);
        const server = app.listen(9998);

        try {
          const response = await superagent.get('http://localhost:9998/my-api/forest');
          expect(response.body).toStrictEqual({ error: 'Agent is not started' });
        } finally {
          server.close();
        }
      });
    });

    describe('when the agent is restarted', () => {
      it('should unmount previous routes and mount new ones', async () => {
        const app = express();

        const mounter = new FrameworkMounter('my-api', logger);
        mounter.mountOnExpress(app);
        // @ts-expect-error: testing a protected method
        await mounter.mount(router);

        const server = app.listen(9998);

        try {
          const response = await superagent.get('http://localhost:9998/my-api/forest');
          expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });

          // Mounting new routes (a.k.a restart)
          // @ts-expect-error: testing a protected method
          await mounter.remount(newRouter);

          const newResponse = await superagent.get('http://localhost:9998/my-api/forest/resource');
          expect(newResponse.body).toStrictEqual({ message: 'Here is your resource' });

          // The previous route has been unmounted
          await expect(superagent.get('http://localhost:9998/my-api/forest')).rejects.toThrow(
            'Not Found',
          );
        } finally {
          server.close();
        }
      });
    });
  });

  describe('in an koa app', () => {
    it('should work in an koa app', async () => {
      const app = new Koa();

      const mounter = new FrameworkMounter('my-api', logger);
      mounter.mountOnKoa(app);
      // @ts-expect-error: testing a protected method
      await mounter.mount(router);

      const server = app.listen(9998);

      try {
        const response = await superagent.get('http://localhost:9998/my-api/forest');
        expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
      } finally {
        server.close();
      }
    });

    describe('when the agent is restarted', () => {
      it('should unmount previous routes and mount new ones', async () => {
        const app = new Koa();

        const mounter = new FrameworkMounter('my-api', logger);
        mounter.mountOnKoa(app);
        // @ts-expect-error: testing a protected method
        await mounter.mount(router);

        const server = app.listen(9998);

        try {
          const response = await superagent.get('http://localhost:9998/my-api/forest');
          expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });

          // Mounting new routes (a.k.a restart)
          // @ts-expect-error: testing a protected method
          await mounter.remount(newRouter);

          const newResponse = await superagent.get('http://localhost:9998/my-api/forest/resource');
          expect(newResponse.body).toStrictEqual({ message: 'Here is your resource' });

          // The previous route has been unmounted
          await expect(superagent.get('http://localhost:9998/my-api/forest')).rejects.toThrow(
            'Not Found',
          );
        } finally {
          server.close();
        }
      });
    });

    describe('when the agent is not started', () => {
      it('should return a default response "Agent is not started"', async () => {
        const app = new Koa();

        const mounter = new FrameworkMounter('my-api', logger);
        mounter.mountOnKoa(app);

        const server = app.listen(9998);

        try {
          const response = await superagent.get('http://localhost:9998/my-api/forest');
          expect(response.body).toStrictEqual({ error: 'Agent is not started' });
        } finally {
          server.close();
        }
      });
    });
  });

  it('should work in an express app', async () => {
    const app = express();

    const mounter = new FrameworkMounter('my-api', logger);
    mounter.mountOnExpress(app);
    // @ts-expect-error: testing a protected method
    await mounter.mount(router);

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
    // @ts-expect-error: testing a protected method
    await mounter.mount(router);

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
    // @ts-expect-error: testing a protected method
    await mounter.mount(router);

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
    // @ts-expect-error: testing a protected method
    await mounter.mount(router);

    await app.listen(9995);

    try {
      const response = await superagent.get('http://localhost:9995/my-api/forest');
      expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
    } finally {
      await app.close();
    }
  });
});
