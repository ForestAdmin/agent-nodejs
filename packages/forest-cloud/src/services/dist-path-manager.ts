import path from 'path';

export default class DistPathManager {
  private readonly cloudCustomizerPath: string;

  constructor(cloudCustomizerPath?: string) {
    this.cloudCustomizerPath = cloudCustomizerPath ?? '.';
  }

  get zip(): string {
    return path.join(this.cloudCustomizerPath, 'dist', 'code-customizations.zip');
  }

  get distCodeCustomizations(): string {
    return path.join(this.cloudCustomizerPath, 'dist', 'code-customizations');
  }

  get localDatasources(): string {
    return path.join(this.cloudCustomizerPath, 'datasources.json');
  }
}
