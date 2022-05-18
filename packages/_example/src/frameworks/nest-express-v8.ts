/* eslint-disable max-classes-per-file */
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Controller('/')
class BasicController {
  @Get()
  findAll() {
    return { error: null, framework: 'Nest/Express.js' };
  }
}

@Module({ imports: [], controllers: [BasicController], providers: [] })
class AppModule {}

export default async function startNestExpressV8() {
  return NestFactory.create(AppModule, { logger: false });
}
