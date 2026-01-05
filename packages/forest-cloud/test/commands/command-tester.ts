import type { MakeCommandsForTests } from './utils';
import type { Logger } from '../../src/types';
import type { Command } from 'commander';

import * as process from 'process';
import readline from 'readline';

import { LoggerTester, QuestionTester, SpinnerTester } from './testers';
import makeCommands from '../../src/make-commands';

export default class CommandTester {
  private readonly command: Command;
  private readonly argv: string[];
  private readonly answers: Record<string, string> = {};
  private rl?: readline.Interface;
  public outputs: (LoggerTester | SpinnerTester | QuestionTester)[] = [];
  private lastSpinnerText: string;

  constructor(mocks: MakeCommandsForTests, argv: string[]) {
    this.command = makeCommands({ ...mocks, logger: this.buildLogger() });
    this.argv = argv;

    this.catchQuestionTraces();
  }

  answerToQuestion(question: string, answer: string): void {
    this.answers[question] = answer;
  }

  get spinner(): SpinnerTester {
    return new SpinnerTester();
  }

  get logger(): LoggerTester {
    return new LoggerTester();
  }

  question(text: string): QuestionTester {
    return new QuestionTester(text);
  }

  async run(): Promise<void> {
    try {
      await this.command.parseAsync(this.argv, { from: 'user' });
      // eslint-disable-next-line no-useless-catch
    } catch (e) {
      throw e;
    } finally {
      this.rl?.close();
    }
  }

  private catchQuestionTraces() {
    jest.clearAllMocks();
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.question = jest.fn().mockImplementation((question, callback) => {
      this.saveOutput(this.question(question));
      const answer = this.answers[question.trim()];
      if (answer) callback(answer);
      else throw new Error(`Unexpected question: ${question}`);
    });
    jest.spyOn(readline, 'createInterface').mockReturnValue(this.rl as any);
  }

  private buildLogger(): Logger {
    return {
      spinner: {
        start: (text: string) => {
          if (!text) {
            this.saveOutput(this.spinner.start(this.lastSpinnerText));

            return;
          }

          this.lastSpinnerText = text;
          this.saveOutput(this.spinner.start(text));
        },
        succeed: (text: string) => {
          this.saveOutput(this.spinner.succeed(text));
        },
        warn: (text: string) => {
          this.saveOutput(this.spinner.warn(text));
        },
        info: (text: string) => {
          this.saveOutput(this.spinner.info(text));
        },
        fail: (text: string) => {
          this.saveOutput(this.spinner.fail(text));
        },
        stop: () => {
          this.saveOutput(this.spinner.stop());
        },
      },
      info: (text?: string, prefix?: string) => {
        this.saveOutput(this.logger.info(text).prefixed(prefix));
      },
      error: (text?: string, prefix?: string) => {
        this.saveOutput(this.logger.error(text).prefixed(prefix));
      },
      warn: (text?: string, prefix?: string) => {
        this.saveOutput(this.logger.warn(text).prefixed(prefix));
      },
      debug: (text?: string, prefix?: string) => {
        this.saveOutput(this.logger.debug(text).prefixed(prefix));
      },
      log: (text?: string, prefix?: string) => {
        this.saveOutput(this.logger.log(text).prefixed(prefix));
      },
      write: (text: string, outputType?: 'stderr' | 'stdout') => {
        this.saveOutput(this.logger.write(text, outputType));
      },
    };
  }

  private saveOutput(output: SpinnerTester | LoggerTester | QuestionTester): void {
    this.outputs.push(output);
  }
}
