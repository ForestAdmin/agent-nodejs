import ora from 'ora';

import { BusinessError } from '../errors';

/**
 * Build an action that handles Business errors and can use a spinner
 * @param fn fonction to execute when performing the action
 * @returns
 */
export default function actionRunner(fn: (spinner: ora.Ora, ...args) => Promise<unknown>) {
  return async (...args) => {
    const spinner = ora();

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

/**
 * Build an action that handles Business errors and runs a spinner
 * @param fn fonction to execute when performing the action
 * @returns
 */
export function actionRunnerWithSpinner(fn: (spinner: ora.Ora, ...args) => Promise<unknown>) {
  return actionRunner(async (spinner, ...args) => {
    spinner.start();
    await fn(spinner, ...args);
  });
}

/**
 * Build an action based on several steps.
 * @param steps
 * Each step is a function that takes as parameters a context, and the arguments of the command.
 * The context is a mutable object that is passed to every step. It includes the spinner by default,
 * and properties can be added to pass data between steps.
 * @returns
 */
export function multiStepsActionRunner(
  steps: Array<
    (context: any & { spinner: ora.Ora }, ...args) => Promise<{ keepGoing: boolean } | void>
  >,
) {
  return actionRunner(async (spinner, ...args) => {
    const context = { spinner };

    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      const stepResponse = await step(context, ...args);

      if (stepResponse && stepResponse.keepGoing === false) {
        console.log('Operation aborted.');

        return;
      }
    }
  });
}
