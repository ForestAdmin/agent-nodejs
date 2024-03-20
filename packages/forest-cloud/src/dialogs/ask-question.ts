import readline from 'readline';

export default async function askQuestion(question: string): Promise<boolean> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${question} (yes/no) `, answer => {
      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        resolve(false);
      }

      rl.close();
      resolve(true);
    });
  });
}
