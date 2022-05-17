import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Module({ imports: [], controllers: [], providers: [] })
class AppModule {}

export default async function startNestExpressV8() {
  return NestFactory.create(AppModule, { logger: false });
}
