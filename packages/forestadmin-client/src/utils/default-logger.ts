const knownLevels = ['debug', 'info', 'warn', 'error'];

export default function defaultLogger(level: string, ...args: unknown[]) {
  const lowerCaseLevel = level.toLowerCase();

  if (knownLevels.includes(lowerCaseLevel)) {
    // eslint-disable-next-line no-console
    console[lowerCaseLevel](...args);
  } else {
    console.debug(...args);
  }
}
