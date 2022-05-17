import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Module({ imports: [], controllers: [], providers: [] })
class AppModule {}

export default async function startNestFastifyV8() {
  return NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    logger: false,
  });
}
