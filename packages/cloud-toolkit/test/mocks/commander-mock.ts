import makeProgram from '../../src/command';

export default function executeCommand(argv: string[]) {
  return new Promise<void>(resolve => {
    makeProgram({
      exit: () => {
        console.log('exit');
        resolve();
      },
      writeOut: () => {
        console.log('writeOut');
        resolve();
      },
      writeErr: () => {
        console.log('writeErr');
        resolve();
      },
    }).parse(argv, {
      from: 'user',
    });
  });
}
