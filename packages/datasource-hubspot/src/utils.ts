export async function executeAfterDelay<CallbackType>(
  fn: () => Promise<CallbackType>,
  delayInMs: number,
): Promise<CallbackType> {
  return new Promise(resolve => {
    setTimeout(() => fn().then(resolve), delayInMs);
  });
}

export async function retryIfLimitReached<CallbackType>(
  fn: () => Promise<CallbackType>,
  retries: number,
  delayInMs: number,
): Promise<CallbackType> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && error.code === 429) {
      return executeAfterDelay(() => retryIfLimitReached(fn, retries - 1, delayInMs), delayInMs);
    }

    throw error;
  }
}
