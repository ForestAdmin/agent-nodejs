import { Command } from 'commander';
import readline from 'readline';

export default class CommandTester {
  private readonly command: Command;
  private readonly argv: string[];
  private readonly answers: Record<string, string> = {};
  public outputs: string[] = [];
  constructor(command: Command, argv: string[]) {
    this.command = command;
    this.argv = argv;

    this.mockReadline();
    this.mockOutput();
  }

  answerToQuestion(question: string, answer: string): void {
    this.answers[question] = answer;
  }

  run(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.command.exitOverride((err: Error) => {
        if (err) reject(err);
        resolve();
      });
      // we must mock process.exit to avoid exiting the process
      process.exit = jest.fn().mockImplementation(() => reject(new Error('process exist'))) as any;

      this.command.parse(this.argv, { from: 'user' });
    });
  }

  text(message: string): string {
    return `- ${message}`;
  }

  success(message: string): string {
    const successIcon = '[32m✔[39m'; // '✔'

    return `${successIcon} ${message}`;
  }

  warning(message: string): string {
    const warningIcon = '[33m⚠[39m'; // '⚠'

    return `${warningIcon} ${message}`;
  }

  info(message: string): string {
    const infoIcon = '[34mℹ[39m'; // 'ℹ'

    return `${infoIcon} ${message}`;
  }

  error(message: string): string {
    const errorIcon = '[31m✖[39m'; // '✖'

    return `${errorIcon} ${message}`;
  }

  private mockReadline() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    rl.question = jest.fn().mockImplementation((question, callback) => {
      process.stdout.write(`${question}\n`);
      this.outputs.push(question.trim());
      const answer = this.answers[question.trim()];

      if (answer) {
        callback(answer);
      } else {
        throw new Error(`Unexpected question: ${question}`);
      }
    });
    jest.spyOn(readline, 'createInterface').mockReturnValue(rl as any);
  }

  private mockOutput() {
    jest.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      this.outputs.push(chunk.toString().trim());
      process.stdout.write(chunk);

      return true;
    });
  }
}
