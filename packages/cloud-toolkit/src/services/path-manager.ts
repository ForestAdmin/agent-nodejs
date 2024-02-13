import path from 'path';

export default class PathManager {
  private _tmp;
  private _home;
  constructor(tmp, home) {
    this._tmp = tmp;
    this._home = home;
  }

  public get home() {
    return this._home;
  }

  public get tmp() {
    return this._tmp;
  }

  public get zip() {
    return path.join(this.tmp, 'cloud-customizer.zip');
  }

  public get extracted() {
    return path.join(this.tmp, 'cloud-customizer-main');
  }

  public get cloudCustomizer() {
    return path.join('.', 'cloud-customizer');
  }

  public get typings() {
    return path.join(this.cloudCustomizer, 'typings.d.ts');
  }

  public get index() {
    return path.join(this.cloudCustomizer, 'src', 'index.ts');
  }

  public get env() {
    return path.join(this.cloudCustomizer, '.env');
  }

  public get dotEnvTemplate() {
    return path.join('..', 'templates', 'env.txt');
  }

  public get helloWorldTemplate() {
    return path.join('..', 'templates', 'hello-world.txt');
  }

  public get typingsAfterBootstrapped() {
    return path.join('typings.d.ts');
  }
}
