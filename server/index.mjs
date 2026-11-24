import { createReadStream, mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { midtransSandbox, PaymentError } from './midtrans.mjs';
import { openPayments } from './payments.mjs';
import { openAccounts, sessionCookie } from './accounts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const paymentWorkspace = 'room-access-v1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function reply(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

function requireSameOrigin(request) {
  if (request.headers['sec-fetch-site'] === 'cross-site' ||
      (request.headers.origin && (!URL.canParse(request.headers.origin) || new URL(request.headers.origin).host !== request.headers.host))) {
    throw new PaymentError(403, 'Gunakan DEV-MATCH dari alamat server yang sama.');
  }
}

async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new PaymentError(415, 'Gunakan Content-Type application/json.');
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > 32768) {
      request.resume();
      throw new PaymentError(413, 'Ukuran permintaan terlalu besar.');
    }
    chunks.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data === null || Array.isArray(data) || typeof data !== 'object') throw new TypeError();
    return data;
  } catch {
    throw new PaymentError(400, 'Data JSON tidak valid.');
  }
}

async function servePage(request, response, pathname) {
  const page = pathname === '/' ? '/index.html' : pathname;
  const file = resolve(root, `.${page}`);
  const type = mime[extname(file)];
  const allowed = /^\/(?:index|devmatch-[\w-]+)\.html$/.test(page) || /^\/assets\/[\w./-]+$/.test(page);
  if (!allowed || !type || !file.startsWith(`${resolve(root)}${sep}`)) {
    return reply(response, 404, { error: 'Halaman tidak ditemukan.' });
  }
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return reply(response, 404, { error: 'Halaman tidak ditemukan.' });
  response.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
  if (request.method === 'HEAD') return response.end();
  createReadStream(file).on('error', () => response.destroy()).pipe(response);
}

export function createApp(payments, accounts, { secureCookie = false } = {}) {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const url = new URL(request.url, 'http://localhost');
      const { pathname } = url;
      if (request.method === 'POST' && pathname === '/api/payments/midtrans/webhook') {
        await payments.webhook(await readJson(request));
        return reply(response, 200, { received: true });
      }
      if (pathname === '/api/auth/session' && request.method === 'GET') {
        return reply(response, 200, { account: accounts.current(request) });
      }
      const authRoute = pathname.match(/^\/api\/auth\/(login|register|logout)$/);
      if (authRoute && request.method === 'POST') {
        requireSameOrigin(request);
        const body = await readJson(request);
        const action = authRoute[1];
        if (action === 'logout') {
          accounts.logout(request);
          response.setHeader('Set-Cookie', sessionCookie('', secureCookie));
          return reply(response, 200, { account: null });
        }
        const account = action === 'register' ? await accounts.register(body) : await accounts.login(body);
        const session = accounts.createSession(account, request);
        response.setHeader('Set-Cookie', sessionCookie(session.token, secureCookie));
        return reply(response, action === 'register' ? 201 : 200, { account: session.account });
      }
      if (!pathname.startsWith('/api/')) {
        if (['GET', 'HEAD'].includes(request.method)) return await servePage(request, response, pathname);
        return reply(response, 405, { error: 'Metode tidak tersedia.' });
      }
      const route = pathname.match(/^\/api\/rooms\/([\w-]{1,160})\/payment(?:\/(checkout|refresh))?$/);
      if (!route) return reply(response, 404, { error: 'Endpoint tidak ditemukan.' });
      const [, roomKey, operation] = route;
      const account = accounts.current(request);
      if (!account) throw new PaymentError(401, 'Login ke DEV-MATCH untuk membuka pembayaran proyek.');
      const role = accounts.roomRole(account, roomKey);
      if (!role) throw new PaymentError(403, 'Akun ini belum terdaftar sebagai peserta pembayaran room ini.');
      if (request.method === 'GET' && !operation) {
        return reply(response, 200, { ...payments.snapshot(paymentWorkspace, roomKey), role });
      }
      if (request.method !== 'POST') return reply(response, 405, { error: 'Metode tidak tersedia.' });
      requireSameOrigin(request);
      const body = await readJson(request);
      if ('role' in body) throw new PaymentError(400, 'Peran pembayaran ditentukan oleh sesi server.');
      if (operation === 'checkout') {
        if (role !== 'client') throw new PaymentError(403, 'Pembayaran tersedia bagi peran Client.');
        return reply(response, 200, await payments.checkout(paymentWorkspace, roomKey, body.kind));
      }
      const result = operation === 'refresh' ? await payments.refresh(paymentWorkspace, roomKey)
        : payments.change(paymentWorkspace, roomKey, role, body);
      return reply(response, 200, { ...result, role });
    } catch (error) {
      if (error instanceof PaymentError) return reply(response, error.status, { error: error.message });
      console.error('Payment server error:', error.message);
      return reply(response, 500, { error: 'Server pembayaran mengalami gangguan.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = join(root, '.payment-data');
  mkdirSync(dataDir, { recursive: true });
  const gateway = midtransSandbox({
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
    signatureSecret: process.env.MIDTRANS_SIGNATURE_SECRET || undefined
  });
  const database = join(dataDir, 'sandbox.sqlite');
  const payments = openPayments(database, gateway);
  const accounts = openAccounts(database);
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const app = createApp(payments, accounts, { secureCookie: process.env.PAYMENT_SECURE_COOKIE === '1' });
  app.listen(port, host, () => console.log(`DEV-MATCH Sandbox di http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => app.close(() => {
      accounts.close();
      payments.close();
    }));
  }
}
