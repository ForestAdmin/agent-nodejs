import { BusinessError } from '../errors';
import { Spinner } from '../types';

export default function actionRunner(spinner: Spinner, fn: (...args) => Promise<any>) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      const error: Error = e;

      if (error instanceof BusinessError) {
        spinner.fail(error.message);
      } else {
        throw error;
      }
    } finally {
      spinner.stop();
    }
  };
}
