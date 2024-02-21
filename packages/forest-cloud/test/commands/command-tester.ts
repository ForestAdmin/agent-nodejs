import { Command } from 'commander';
import * as process from 'process';
import readline from 'readline';

import { LoggerTester, QuestionTester, SpinnerTester } from './testers';
import { MakeCommandsForTests } from './utils';
import makeCommands from '../../src/make-commands';
import { Logger } from '../../src/types';

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

  start(message: string): string {
    return `- ${message}`;
  }

  succeed(message: string): string {
    return `${logSymbols.success} ${message}`;
  }

  warn(message: string): string {
    return `${logSymbols.warning} ${message}`;
  }

  info(message: string): string {
    return `${logSymbols.info} ${message}`;
  }

  fail(message: string): string {
    return `${logSymbols.error} ${message}`;
  }

  logInfo(message: string): string {
    return `(info) ${message}`;
  }

  logError(message: string): string {
    return `(error) ${message}`;
  }

  logDebug(message: string): string {
    return `(debug) ${message}`;
  }

  logWarn(message: string): string {
    return `(warn) ${message}`;
  }

  log(message: string): string {
    return `(log) ${message}`;
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
      info: (text?: string) => {
        this.saveOutput(this.logInfo(text));
      },
      write: (text: string, outputType?: 'stderr' | 'stdout') => {
        this.saveOutput(this.logger.write(text, outputType));
      },
      warn: (text?: string) => {
        this.saveOutput(this.logWarn(text));
      },
      debug: (text?: string) => {
        this.saveOutput(this.logDebug(text));
      },
      log: (text?: string) => {
        this.saveOutput(this.log(text));
      },
    };
  }

  private saveOutput(output: SpinnerTester | LoggerTester | QuestionTester): void {
    this.outputs.push(output);
  }
}
