// eslint-disable-next-line import/prefer-default-export
export async function executeAfterDelay<CallbackType>(
  fn: () => Promise<CallbackType>,
  delayInMs: number,
): Promise<CallbackType> {
  return new Promise(resolve => {
    setTimeout(() => fn().then(resolve), delayInMs);
  });
}
