import { homedir } from 'os';
import path from 'path';

export default class DistPathManager {
  private readonly cloudCustomizerPath: string;

  constructor(cloudCustomizerPath?: string) {
    this.cloudCustomizerPath = cloudCustomizerPath ?? '.';
  }

  get zip(): string {
    return path.join(this.cloudCustomizerPath, 'dist', 'code-customizations.zip');
  }

  get zipPath() {
    return path.resolve(this.zip);
  }

  get typings(): string {
    return path.join(this.cloudCustomizerPath, 'typings.d.ts');
  }

  get distCodeCustomizations(): string {
    return path.join(this.cloudCustomizerPath, 'dist', 'code-customizations');
  }

  get distCodeCustomizationsPath(): string {
    return path.resolve(this.distCodeCustomizations);
  }

  get localDatasources(): string {
    return path.join(this.cloudCustomizerPath, 'datasources.js');
  }

  get localDatasourcesPath(): string {
    return path.resolve(this.localDatasources);
  }

  get localCloudEnvironmentConfig(): string {
    return path.join(homedir(), '.forest.d', '.environments.json');
  }

  get localCloudEnvironmentConfigPath(): string {
    return path.resolve(this.localCloudEnvironmentConfig);
  }
}
