import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openAccounts } from './accounts.mjs';

const directory = fileURLToPath(new URL('../.payment-data/', import.meta.url));
mkdirSync(directory, { recursive: true });
const accounts = openAccounts(fileURLToPath(new URL('../.payment-data/sandbox.sqlite', import.meta.url)));

try {
  const [, , command, ...args] = process.argv;
  if (command === 'reviewer' && args.length === 1) accounts.promoteReviewer(args[0]);
  else if (command === 'assign' && [3, 4].includes(args.length)) accounts.assignRoom(...args);
  else throw new Error('Gunakan reviewer <email> atau assign <room-id> <email-dev> <email-client> [email-reviewer].');
  console.log('Akses pembayaran diperbarui.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  accounts.close();
}
