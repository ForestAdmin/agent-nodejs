/* eslint-disable max-classes-per-file */
import type { INestApplication } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';

@Controller('/')
class BasicController {
  @Get()
  findAll() {
    return { error: null, framework: 'Nest/Fastify' };
  }
}

@Module({ imports: [], controllers: [BasicController], providers: [] })
class AppModule {}

export default async function startNestFastifyV8(): Promise<INestApplication> {
  return NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
}
