import path from 'path';

export default class BootstrapPathManager {
  private readonly _tmp: string;
  private readonly _home: string;
  private readonly basePath: string;

  constructor(tmp: string, home: string, basePath?: string) {
    this._tmp = tmp;
    this._home = home;
    this.basePath = basePath ?? '.';
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
    return path.join(this.basePath, 'cloud-customizer');
  }

  get typings(): string {
    return path.join(this.basePath, 'typings.d.ts');
  }

  get typingsDuringBootstrap(): string {
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

  get indexTemplate(): string {
    return path.join(__dirname, '..', 'templates', 'index.txt');
  }
}
