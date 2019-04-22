import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

export function prompt(prompt: string) {
  return new Promise<string>(resolve => rl.question(prompt, resolve));
}

export function onSIGINT(cb: () => void) {
  rl.on('SIGINT', cb);
  return () => rl.removeListener('SIGINT', cb);
}

export function onceSIGINT(cb: () => void) {
  rl.on('SIGINT', cb);
  return () => rl.removeListener('SIGINT', cb);
}

export function close() {
  rl.close();
}
