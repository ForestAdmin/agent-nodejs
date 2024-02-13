import { BusinessError } from '../errors';
import { Spinner } from '../types';

export default function actionRunner(buildSpinner: () => Spinner, fn: (...args) => Promise<any>) {
  return async (...args) => {
    const spinner = buildSpinner();

    try {
      await fn(spinner, ...args);
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
