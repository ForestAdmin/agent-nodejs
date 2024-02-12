import path from 'path';

export default class PathManager {
  public readonly downLoadUrl = 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip';
  private tmp;
  constructor(tmp) {
    this.tmp = tmp;
  }

  public get zip() {
    return path.join(this.tmp, 'cloud-customizer.zip');
  }

  public get extracted() {
    return path.join(this.tmp, 'cloud-customizer-main');
  }

  public get cloudCustomizer() {
    const cc = path.join('.', 'cloud-customizer');

    return cc;
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
