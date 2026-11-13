let writeChain: Promise<void> = Promise.resolve();

export function withSerializedWrites<T>(operation: () => Promise<T>): Promise<T> {
  const previous = writeChain;
  let release!: () => void;
  writeChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  return previous
    .then(operation)
    .finally(release);
}
