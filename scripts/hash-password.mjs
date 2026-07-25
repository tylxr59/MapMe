import argon2 from 'argon2';
import { stdin, stdout } from 'node:process';

async function readPassword() {
  if (!stdin.isTTY) {
    const chunks = [];
    for await (const chunk of stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8').trimEnd();
  }
  stdout.write('Shared administrator password: ');
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (character) => {
      if (character === '\u0003') {
        stdin.setRawMode(false);
        reject(new Error('Cancelled'));
        return;
      }
      if (character === '\r' || character === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off('data', onData);
        stdout.write('\n');
        resolve(value);
      } else if (character === '\u007f') {
        value = value.slice(0, -1);
      } else {
        value += character;
      }
    };
    stdin.on('data', onData);
  });
}

try {
  const password = await readPassword();
  if (password.length < 8) throw new Error('Password must contain at least 8 characters');
  if (password.length > 1024) throw new Error('Password is too long');
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32
  });
  stdout.write(`${hash}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
