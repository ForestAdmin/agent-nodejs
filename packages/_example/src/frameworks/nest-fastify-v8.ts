/* eslint-disable max-classes-per-file */
import { Controller, Get, Module } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { NestFactory } from '@nestjs/core';

@Controller('/')
class BasicController {
  @Get()
  findAll() {
    return { error: null, framework: 'Nest/Fastify' };
  }
}

@Module({ imports: [], controllers: [BasicController], providers: [] })
class AppModule {}

export default async function startNestFastifyV8() {
  return NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
}
