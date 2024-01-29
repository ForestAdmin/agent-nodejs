import { exec } from 'child_process';
import path from 'path';

export default async function login() {
  return new Promise<void>((resolve, reject) => {
    const pathForest = path.join(__dirname, '..', '..', 'node_modules', '.bin', 'forest');
    const process = exec(`node ${pathForest} login`);
    process.stdout.on('data', console.log);
    process.stderr.on('data', console.error);
    process.on('close', resolve);
    process.on('error', reject);
  });
}
