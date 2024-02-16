import { Command } from 'commander';
import logSymbols from 'log-symbols';
import * as process from 'process';
import readline from 'readline';

import { MakeCommandsForTests } from './utils';
import makeCommands from '../../src/make-commands';
import { Logger } from '../../src/types';

export default class CommandTester {
  private readonly command: Command;
  private readonly argv: string[];
  private readonly answers: Record<string, string> = {};
  private rl?: readline.Interface;
  public outputs: string[] = [];
  private lastSpinnerText: string;

  constructor(mocks: MakeCommandsForTests, argv: string[]) {
    this.command = makeCommands({ ...mocks, logger: this.buildLogger() });
    this.argv = argv;

    this.catchQuestionTraces();
  }

  answerToQuestion(question: string, answer: string): void {
    this.answers[question] = answer;
  }

  async run(): Promise<void> {
    try {
      await this.command.parseAsync(this.argv, { from: 'user' });
    } catch (e) {
      throw new Error(e);
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

  log(message: string): string {
    return `(log) ${message}`;
  }

  logError(message: string): string {
    return `(error) ${message}`;
  }

  private catchQuestionTraces() {
    jest.clearAllMocks();
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.question = jest.fn().mockImplementation((question, callback) => {
      this.saveOutput(question);
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
            this.saveOutput(this.start(this.lastSpinnerText));

            return;
          }

          this.lastSpinnerText = text;
          this.saveOutput(this.start(text));
        },
        succeed: (text: string) => {
          this.saveOutput(this.succeed(text));
        },
        warn: (text: string) => {
          this.saveOutput(this.warn(text));
        },
        info: (text: string) => {
          this.saveOutput(this.info(text));
        },
        fail: (text: string) => {
          this.saveOutput(this.fail(text));
        },
        stop: jest.fn(),
      },
      log: (text?: string) => {
        this.saveOutput(this.log(text));
      },
      error: (text?: string) => {
        this.saveOutput(this.logError(text));
      },
    };
  }

  private saveOutput(output: string | Uint8Array): void {
    this.outputs.push(output.toString().trim());
  }
}
