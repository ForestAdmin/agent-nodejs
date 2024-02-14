import path from 'path';

export default class BootstrapPathManager {
  private readonly _tmp: string;
  private readonly _home: string;
  private readonly cloudCustomizerPath: string;

  constructor(tmp: string, home: string, cloudCustomizerPath?: string) {
    this._tmp = tmp;
    this._home = home;
    this.cloudCustomizerPath = cloudCustomizerPath ?? '.';
  }

  get home(): string {
    return this._home;
  }

  get tmp(): string {
    return this._tmp;
  }

  get zip(): string {
    return path.join(this.tmp, 'cloud-customizer.zip');
  }

  get extracted(): string {
    return path.join(this.tmp, 'cloud-customizer-main');
  }

  get cloudCustomizer(): string {
    return path.join(this.cloudCustomizerPath, 'cloud-customizer');
  }

  get typings(): string {
    return path.join(this.cloudCustomizer, 'typings.d.ts');
  }

  get index(): string {
    return path.join(this.cloudCustomizer, 'src', 'index.ts');
  }

  get env(): string {
    return path.join(this.cloudCustomizer, '.env');
  }

  get dotEnvTemplate(): string {
    return path.join(__dirname, '..', 'templates', 'env.txt');
  }

  get helloWorldTemplate(): string {
    return path.join(__dirname, '..', 'templates', 'hello-world.txt');
  }

  get typingsAfterBootstrapped(): string {
    return path.join('typings.d.ts');
  }
}
