// eslint-disable-next-line max-classes-per-file
export class SpinnerTester {
  private text: string;
  private type: 'succeed' | 'warning' | 'info' | 'fail' | undefined;
  private isStopped = false;

  start(message: string): this {
    this.text = `- ${message}`;

    return this;
  }

  succeed(message: string): this {
    this.text = message;
    this.type = 'succeed';

    return this;
  }

  warn(message: string): this {
    this.text = message;
    this.type = 'warning';

    return this;
  }

  info(message: string): this {
    this.text = message;
    this.type = 'info';

    return this;
  }

  fail(message: string): this {
    this.text = message;
    this.type = 'fail';

    return this;
  }

  stop(): this {
    this.isStopped = true;

    return this;
  }
}

export class LoggerTester {
  private text: string;
  private prefix: string;
  private type: 'succeed' | 'warning' | 'info' | 'error' | 'log' | 'write' | undefined;
  private outputTypeForWrite: 'stderr' | 'stdout' | undefined;

  info(message: string): this {
    this.text = message;
    this.type = 'info';

    return this;
  }

  error(message: string): this {
    this.text = message;
    this.type = 'error';

    return this;
  }

  debug(message: string): this {
    this.text = message;
    this.type = 'info';

    return this;
  }

  warn(message: string): this {
    this.text = message;
    this.type = 'warning';

    return this;
  }

  log(message: string): this {
    this.text = message;
    this.type = 'log';

    return this;
  }

  prefixed(prefix: string): this {
    this.prefix = prefix;

    return this;
  }

  write(message: string, outputType?: 'stderr' | 'stdout'): this {
    this.text = message;
    this.type = 'write';
    this.outputTypeForWrite = outputType;

    return this;
  }
}

export class QuestionTester {
  private text: string;

  constructor(message: string) {
    this.text = message;
  }
}
