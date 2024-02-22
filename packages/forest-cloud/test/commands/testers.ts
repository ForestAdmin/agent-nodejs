export class SpinnerTester {
  private text: string;
  private type: 'succeed' | 'warning' | 'info' | 'fail' | undefined;

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
}

export class LoggerTester {
  private text: string;
  private prefix: string;
  private type: 'succeed' | 'warning' | 'info' | 'fail' | 'log' | undefined;

  info(message: string): this {
    this.text = message;
    this.type = 'info';

    return this;
  }

  error(message: string): this {
    this.text = message;
    this.type = 'fail';

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
}

export class QuestionTester {
  private text: string;

  constructor(message: string) {
    this.text = message;
  }
}
