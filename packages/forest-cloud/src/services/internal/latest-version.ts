import childProcess from 'child_process';

export default async function latestVersion(packageName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdOut = '';
    let stdErr = '';

    const result = childProcess.spawn('npm', ['--loglevel=error', 'view', packageName, 'version']);

    result.on('error', reject);
    result.stderr.on('data', d => {
      stdErr += d.toString();
    });
    result.stdout.on('data', d => {
      stdOut += d.toString();
    });

    result.once('close', code => {
      if (!code) {
        resolve(stdOut.trim());
      } else {
        reject(new Error(`Error while retrieving the version:${stdErr.trim()}`));
      }
    });
  });
}
