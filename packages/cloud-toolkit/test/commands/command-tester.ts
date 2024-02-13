import { Command } from 'commander';
import logSymbols from 'log-symbols';
import * as process from 'process';
import readline from 'readline';

import makeCommands from '../../src/make-commands';
import { MakeCommands } from '../../src/types';

export default class CommandTester {
  private readonly command: Command;
  private readonly argv: string[];
  private readonly answers: Record<string, string> = {};
  private rl?: readline.Interface;
  public outputs: string[] = [];
  constructor(mocks: MakeCommands, argv: string[]) {
    this.command = makeCommands(mocks);
    this.argv = argv;

    this.catchQuestionTraces();
    this.catchSpinnerTraces();
  }

  answerToQuestion(question: string, answer: string): void {
    this.answers[question] = answer;
  }

  async run(): Promise<void> {
    try {
      await this.command.parseAsync(this.argv, { from: 'user' });
    } catch (e) {
      /* empty */
    } finally {
      this.rl?.close();
    }
  }

  text(message: string): string {
    return `- ${message}`;
  }

  success(message: string): string {
    return `${logSymbols.success} ${message}`;
  }

  warning(message: string): string {
    return `${logSymbols.warning} ${message}`;
  }

  info(message: string): string {
    return `${logSymbols.info} ${message}`;
  }

  error(message: string): string {
    return `${logSymbols.error} ${message}`;
  }

  private catchQuestionTraces() {
    jest.clearAllMocks();
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.question = jest.fn().mockImplementation((question, callback) => {
      // we want to display the question in the stdout to display it in the test output
      process.stdout.write(`${question}\n`);
      this.saveOutput(question);
      const answer = this.answers[question.trim()];
      if (answer) callback(answer);
      else throw new Error(`Unexpected question: ${question}`);
    });
    jest.spyOn(readline, 'createInterface').mockReturnValue(this.rl as any);
  }

  private catchSpinnerTraces() {
    // ora uses process.stderr.write to display the spinner
    jest.spyOn(process.stderr, 'write').mockImplementation(output => {
      this.saveOutput(output);
      // we want to display the spinner in the stdout to display it in the test output
      process.stdout.write(output);

      return true;
    });
  }

  private saveOutput(output: string | Uint8Array): void {
    this.outputs.push(output.toString().trim());
  }
}
