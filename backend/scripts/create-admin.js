const readline = require('readline');
const { pool } = require('../src/config/db');
const authService = require('../src/services/auth');

const ask = (prompt) => new Promise((resolve) => {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  terminal.question(prompt, (answer) => {
    terminal.close();
    resolve(answer.trim());
  });
});

const askHidden = (prompt) => new Promise((resolve, reject) => {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    reject(new Error('Admin setup requires an interactive terminal so the password stays hidden.'));
    return;
  }
  process.stdout.write(prompt);
  process.stdin.setEncoding('utf8');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = '';
  const onData = (chunk) => {
    for (const character of chunk) {
      if (character === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        reject(new Error('Admin setup cancelled.'));
        return;
      }
      if (character === '\r' || character === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (character === '\u0008' || character === '\u007f') {
        if (value.length) {
          value = Array.from(value).slice(0, -1).join('');
          process.stdout.write('\b \b');
        }
      } else if (character >= ' ') {
        value += character;
        process.stdout.write('*');
      }
    }
  };
  process.stdin.on('data', onData);
});

const main = async () => {
  const email = (await ask('Admin email: ')).toLowerCase();
  const displayName = await ask('Admin display name: ');
  const password = await askHidden('Password (at least 12 characters): ');
  const admin = await authService.createFirstAdmin({ email, displayName, password });
  process.stdout.write(`Admin account created for ${admin.email}.\n`);
};

main()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => pool.end());
