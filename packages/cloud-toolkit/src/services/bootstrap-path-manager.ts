import path from 'path';

export default class BootstrapPathManager {
  private readonly _tmp: string;
  private readonly _home: string;
  private readonly dirname: string;
  private readonly cloudCustomizerPath: string;

  constructor(tmp: string, home: string, cloudCustomizerPath?: string) {
    this._tmp = tmp;
    this._home = home;
    this.cloudCustomizerPath = cloudCustomizerPath ?? '.';
    this.dirname = __dirname;
  }

  public get home(): string {
    return this._home;
  }

  public get tmp(): string {
    return this._tmp;
  }

  public get zip(): string {
    return path.join(this.tmp, 'cloud-customizer.zip');
  }

  public get extracted(): string {
    return path.join(this.tmp, 'cloud-customizer-main');
  }

  public get cloudCustomizer(): string {
    return path.join(this.cloudCustomizerPath, 'cloud-customizer');
  }

  public get typings(): string {
    return path.join(this.cloudCustomizer, 'typings.d.ts');
  }

  public get index(): string {
    return path.join(this.cloudCustomizer, 'src', 'index.ts');
  }

  public get env(): string {
    return path.join(this.cloudCustomizer, '.env');
  }

  public get dotEnvTemplate(): string {
    return path.join(this.dirname, '..', 'templates', 'env.txt');
  }

  public get helloWorldTemplate(): string {
    return path.join(this.dirname, '..', 'templates', 'hello-world.txt');
  }

  public get typingsAfterBootstrapped(): string {
    return path.join('typings.d.ts');
  }
}
