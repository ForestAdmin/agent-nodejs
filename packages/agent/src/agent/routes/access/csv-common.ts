import { Context } from 'koa';

export default class CsvCommon {
  static buildResponseContext(context: Context): void {
    const { filename } = context.request.query;

    context.response.type = 'text/csv; charset=utf-8';
    context.response.attachment(`attachment; filename=${filename}`);
    context.response.lastModified = new Date();
    context.response.set({ 'X-Accel-Buffering': 'no' });
    context.response.set({ 'Cache-Control': 'no-cache' });
  }
}
