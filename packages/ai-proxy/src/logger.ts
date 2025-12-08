export type Logger = {
  error: (...args: unknown[]) => void;
};

export const defaultLogger: Logger = {
  error: (...args: unknown[]) => console.error(...args),
};
