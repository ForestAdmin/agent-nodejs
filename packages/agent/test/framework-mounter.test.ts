/* eslint-disable max-classes-per-file */
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import Router from '@koa/router';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import express from 'express';
import Fastify3 from 'fastify';
import Fastify2 from 'fastify2';
import Fastify4 from 'fastify4';
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

// Router with nested paths and query string echo for testing URL handling
const nestedRouter = new Router()
  .get('/', async ctx => {
    ctx.response.body = { path: '/', query: ctx.query };
  })
  .get('/items', async ctx => {
    ctx.response.body = { path: '/items', query: ctx.query };
  })
  .get('/items/:id', async ctx => {
    ctx.response.body = { path: `/items/${ctx.params.id}`, query: ctx.query };
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

      describe('when a port is 0', () => {
        it('should use a random available PORT', async () => {
          const mounter = new FrameworkMounter('my-api', logger);
          mounter.mountOnStandaloneServer(0, 'localhost');

          try {
            // @ts-expect-error: testing a protected method
            await mounter.mount(router);

            const response = await superagent.get(
              `http://localhost:${mounter.standaloneServerPort}/my-api/forest`,
            );
            expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
            expect(mounter.standaloneServerPort).not.toEqual('3351');
          } finally {
            await mounter.stop();
          }
        });
      });

      describe('when the port is undefined', () => {
        it('should use the PORT environment variable', async () => {
          process.env.PORT = '9998';
          const mounter = new FrameworkMounter('my-api', logger);
          mounter.mountOnStandaloneServer(undefined, 'localhost');

          try {
            // @ts-expect-error: testing a protected method
            await mounter.mount(router);

            const response = await superagent.get(
              `http://localhost:${mounter.standaloneServerPort}/my-api/forest`,
            );
            expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
            expect(mounter.standaloneServerPort).toEqual(9998);
          } finally {
            await mounter.stop();
            process.env.PORT = undefined;
          }
        });
      });

      describe('when the port is undefined and no PORT environment variable', () => {
        it('should use the default port 3351', async () => {
          const mounter = new FrameworkMounter('my-api', logger);
          mounter.mountOnStandaloneServer(undefined, 'localhost');

          try {
            // @ts-expect-error: testing a protected method
            await mounter.mount(router);

            const response = await superagent.get(
              `http://localhost:${mounter.standaloneServerPort}/my-api/forest`,
            );
            expect(response.body).toStrictEqual({ error: null, message: 'Agent is running' });
            expect(mounter.standaloneServerPort).toEqual(3351);
          } finally {
            await mounter.stop();
          }
        });
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
    ['v4', Fastify4],
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

  // Non-regression tests for URL prefix stripping in Fastify
  // These tests ensure nested routes work correctly after the fix for
  // the 404 error caused by @fastify/express not stripping the prefix from req.url
  describe('nested routes and query strings', () => {
    it('should handle nested routes in NestJS/Fastify', async () => {
      @Module({ imports: [], controllers: [], providers: [] })
      class AppModule {}
      const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        {
          logger: false,
        },
      );

      const mounter = new FrameworkMounter('my-api', logger);
      mounter.mountOnNestJs(app);
      // @ts-expect-error: testing a protected method
      await mounter.mount(nestedRouter);

      await app.listen(9994);

      try {
        // Test root path
        const rootResponse = await superagent.get('http://localhost:9994/my-api/forest');
        expect(rootResponse.body).toStrictEqual({ path: '/', query: {} });

        // Test nested path - this was returning 404 before the fix
        const itemsResponse = await superagent.get('http://localhost:9994/my-api/forest/items');
        expect(itemsResponse.body).toStrictEqual({ path: '/items', query: {} });

        // Test nested path with parameter
        const itemResponse = await superagent.get('http://localhost:9994/my-api/forest/items/123');
        expect(itemResponse.body).toStrictEqual({ path: '/items/123', query: {} });

        // Test with query strings
        const queryResponse = await superagent.get(
          'http://localhost:9994/my-api/forest/items?timezone=Europe/Paris&search=test',
        );
        expect(queryResponse.body).toStrictEqual({
          path: '/items',
          query: { timezone: 'Europe/Paris', search: 'test' },
        });
      } finally {
        await app.close();
      }
    });

    it('should handle nested routes in Express', async () => {
      const app = express();

      const mounter = new FrameworkMounter('my-api', logger);
      mounter.mountOnExpress(app);
      // @ts-expect-error: testing a protected method
      await mounter.mount(nestedRouter);

      const server = app.listen(9993);

      try {
        // Test nested path
        const itemsResponse = await superagent.get('http://localhost:9993/my-api/forest/items');
        expect(itemsResponse.body).toStrictEqual({ path: '/items', query: {} });

        // Test nested path with parameter
        const itemResponse = await superagent.get('http://localhost:9993/my-api/forest/items/456');
        expect(itemResponse.body).toStrictEqual({ path: '/items/456', query: {} });

        // Test with query strings
        const queryResponse = await superagent.get(
          'http://localhost:9993/my-api/forest/items?page=1&limit=10',
        );
        expect(queryResponse.body).toStrictEqual({
          path: '/items',
          query: { page: '1', limit: '10' },
        });
      } finally {
        server.close();
      }
    });

    it('should handle nested routes in Koa', async () => {
      const app = new Koa();

      const mounter = new FrameworkMounter('my-api', logger);
      mounter.mountOnKoa(app);
      // @ts-expect-error: testing a protected method
      await mounter.mount(nestedRouter);

      const server = app.listen(9992);

      try {
        // Test nested path
        const itemsResponse = await superagent.get('http://localhost:9992/my-api/forest/items');
        expect(itemsResponse.body).toStrictEqual({ path: '/items', query: {} });

        // Test nested path with parameter
        const itemResponse = await superagent.get('http://localhost:9992/my-api/forest/items/789');
        expect(itemResponse.body).toStrictEqual({ path: '/items/789', query: {} });

        // Test with query strings
        const queryResponse = await superagent.get(
          'http://localhost:9992/my-api/forest/items?filter=active',
        );
        expect(queryResponse.body).toStrictEqual({
          path: '/items',
          query: { filter: 'active' },
        });
      } finally {
        server.close();
      }
    });

    it('should handle nested routes in standalone mode', async () => {
      const mounter = new FrameworkMounter('my-api', logger);
      mounter.mountOnStandaloneServer(9991, 'localhost');

      try {
        // @ts-expect-error: testing a protected method
        await mounter.mount(nestedRouter);

        // Test nested path
        const itemsResponse = await superagent.get('http://localhost:9991/my-api/forest/items');
        expect(itemsResponse.body).toStrictEqual({ path: '/items', query: {} });

        // Test nested path with parameter
        const itemResponse = await superagent.get('http://localhost:9991/my-api/forest/items/abc');
        expect(itemResponse.body).toStrictEqual({ path: '/items/abc', query: {} });

        // Test with query strings
        const queryResponse = await superagent.get(
          'http://localhost:9991/my-api/forest/items?sort=-createdAt',
        );
        expect(queryResponse.body).toStrictEqual({
          path: '/items',
          query: { sort: '-createdAt' },
        });
      } finally {
        await mounter.stop();
      }
    });

    // Non-regression tests for Fastify v3 and v4
    // These test the auto-registration of @fastify/express and URL prefix stripping
    it('should handle nested routes in Fastify v3', async () => {
      const app = Fastify3();

      const mounter = new FrameworkMounter('my-api', logger);
      mounter.mountOnFastify(app);
      // @ts-expect-error: testing a protected method
      await mounter.mount(nestedRouter);

      await app.ready();
      await app.listen(9990);

      try {
        // Test root path
        const rootResponse = await superagent.get('http://localhost:9990/my-api/forest');
        expect(rootResponse.body).toStrictEqual({ path: '/', query: {} });

        // Test nested path - this was returning 404 before the fix
        const itemsResponse = await superagent.get('http://localhost:9990/my-api/forest/items');
        expect(itemsResponse.body).toStrictEqual({ path: '/items', query: {} });

        // Test nested path with parameter
        const itemResponse = await superagent.get('http://localhost:9990/my-api/forest/items/v3');
        expect(itemResponse.body).toStrictEqual({ path: '/items/v3', query: {} });

        // Test with query strings
        const queryResponse = await superagent.get(
          'http://localhost:9990/my-api/forest/items?version=3&framework=fastify',
        );
        expect(queryResponse.body).toStrictEqual({
          path: '/items',
          query: { version: '3', framework: 'fastify' },
        });
      } finally {
        await app.close();
      }
    });

    it('should handle nested routes in Fastify v4', async () => {
      const app = Fastify4();

      const mounter = new FrameworkMounter('my-api', logger);
      mounter.mountOnFastify(app);
      // @ts-expect-error: testing a protected method
      await mounter.mount(nestedRouter);

      await app.ready();
      await app.listen({ port: 9989 });

      try {
        // Test root path
        const rootResponse = await superagent.get('http://localhost:9989/my-api/forest');
        expect(rootResponse.body).toStrictEqual({ path: '/', query: {} });

        // Test nested path - this was returning 404 before the fix
        const itemsResponse = await superagent.get('http://localhost:9989/my-api/forest/items');
        expect(itemsResponse.body).toStrictEqual({ path: '/items', query: {} });

        // Test nested path with parameter
        const itemResponse = await superagent.get('http://localhost:9989/my-api/forest/items/v4');
        expect(itemResponse.body).toStrictEqual({ path: '/items/v4', query: {} });

        // Test with query strings
        const queryResponse = await superagent.get(
          'http://localhost:9989/my-api/forest/items?version=4&framework=fastify',
        );
        expect(queryResponse.body).toStrictEqual({
          path: '/items',
          query: { version: '4', framework: 'fastify' },
        });
      } finally {
        await app.close();
      }
    });
  });
});
