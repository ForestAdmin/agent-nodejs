import * as fs from 'fs';
import * as path from 'path';

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

export const VERSION: string = packageJson.version;
export const NAME: string = packageJson.name;
