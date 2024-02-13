import path from 'path';

export default class PathManager {
  private _tmp: string;
  private _home: string;
  constructor(tmp: string, home: string) {
    this._tmp = tmp;
    this._home = home;
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
    return path.join('.', 'cloud-customizer');
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
    return path.join(__dirname, '..', 'templates', 'env.txt');
  }

  public get helloWorldTemplate(): string {
    return path.join(__dirname, '..', 'templates', 'hello-world.txt');
  }

  public get typingsAfterBootstrapped(): string {
    return path.join('typings.d.ts');
  }
}
