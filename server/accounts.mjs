import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { PaymentError } from './midtrans.mjs';

const derive = promisify(scrypt);
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const sessionSeconds = 7 * 86400;
const sessionToken = request => request.headers.cookie?.match(/(?:^|;\s*)devmatch_session=([\w-]{43})(?:;|$)/)?.[1];
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const normalizePhone = value => typeof value === 'string' ? value.trim().replace(/^0+/, '') : '';

export function sessionCookie(token, secure) {
  return `devmatch_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? sessionSeconds : 0}${secure ? '; Secure' : ''}`;
}

export function openAccounts(filename) {
  const db = new DatabaseSync(filename);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('developer', 'client', 'reviewer')),
      salt TEXT NOT NULL, password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_sessions (
      token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payment_room_members (
      room_key TEXT NOT NULL, role TEXT NOT NULL, account_id INTEGER NOT NULL REFERENCES accounts(id),
      PRIMARY KEY(room_key, role), UNIQUE(room_key, account_id)
    );
  `);

  const publicAccount = ({ id, role, username }) => ({ id, role, username });

  function createSession(account, request) {
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM account_sessions WHERE expires_at <= ?').run(Date.now());
    logout(request);
    db.prepare('INSERT INTO account_sessions VALUES (?, ?, ?)')
      .run(tokenHash(token), account.id, Date.now() + sessionSeconds * 1000);
    return { token, account: publicAccount(account) };
  }

  async function register(body) {
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const { role, password } = body;
    if (!/^[A-Za-z0-9_.]{3,24}$/.test(username) || email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{9,15}$/.test(phone) ||
        typeof password !== 'string' || password.length < 8 || password.length > 128 ||
        !/[A-Z]/.test(password) || !/[^A-Za-z0-9]/.test(password) || body.terms !== true ||
        !['developer', 'client'].includes(role)) {
      throw new PaymentError(400, 'Data pendaftaran atau peran akun tidak valid.');
    }
    const salt = randomBytes(16).toString('hex');
    const hash = (await derive(password, salt, 64)).toString('hex');
    try {
      const result = db.prepare('INSERT INTO accounts (username, email, phone, role, salt, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
        .run(username, email, phone, role, salt, hash);
      return { id: Number(result.lastInsertRowid), username, role };
    } catch (error) {
      if (error.errcode === 2067) throw new PaymentError(409, 'Email atau nomor telepon sudah terdaftar.');
      throw error;
    }
  }

  async function login(body) {
    const { identifier, password } = body;
    if (typeof identifier !== 'string' || identifier.length > 254 ||
        typeof password !== 'string' || !password || password.length > 128) {
      throw new PaymentError(401, 'Email, nomor telepon, atau password tidak cocok.');
    }
    const account = db.prepare('SELECT * FROM accounts WHERE email = ? OR phone = ?')
      .get(normalizeEmail(identifier), normalizePhone(identifier));
    const hash = await derive(password, account?.salt || 'devmatch-account-lookup', 64);
    if (!account || !timingSafeEqual(hash, Buffer.from(account.password_hash, 'hex'))) {
      throw new PaymentError(401, 'Email, nomor telepon, atau password tidak cocok.');
    }
    return account;
  }

  function current(request) {
    const token = sessionToken(request);
    if (!token) return null;
    return db.prepare(`SELECT accounts.id, accounts.role, accounts.username FROM account_sessions
      JOIN accounts ON accounts.id = account_sessions.account_id WHERE token_hash = ? AND expires_at > ?`)
      .get(tokenHash(token), Date.now()) || null;
  }

  function logout(request) {
    const token = sessionToken(request);
    if (token) db.prepare('DELETE FROM account_sessions WHERE token_hash = ?').run(tokenHash(token));
  }

  function roomRole(account, roomKey) {
    if (!account) return null;
    const member = db.prepare('SELECT role FROM payment_room_members WHERE room_key = ? AND account_id = ?')
      .get(roomKey, account.id);
    return member?.role === account.role ? account.role : null;
  }

  function promoteReviewer(email) {
    const account = db.prepare('SELECT id FROM accounts WHERE email = ?').get(normalizeEmail(email));
    if (!account) throw new Error('Akun reviewer belum terdaftar.');
    db.prepare(`UPDATE accounts SET role = 'reviewer' WHERE id = ?`).run(account.id);
  }

  function assignRoom(roomKey, developer, client, reviewer) {
    if (typeof roomKey !== 'string' || !/^[\w-]{1,160}$/.test(roomKey) || !developer || !client) {
      throw new Error('Gunakan ID room, email Developer, email Client, dan email Reviewer jika ada.');
    }
    const participants = Object.entries({ developer, client, reviewer }).filter(([, email]) => email).map(([role, email]) => {
      const account = db.prepare('SELECT id, role FROM accounts WHERE email = ?').get(normalizeEmail(email));
      if (account?.role !== role) throw new Error(`Akun untuk peran ${role} tidak ditemukan.`);
      return [roomKey, role, account.id];
    });
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [key, role, accountId] of participants) {
        const current = db.prepare('SELECT account_id FROM payment_room_members WHERE room_key = ? AND role = ?').get(key, role);
        if (current && current.account_id !== accountId) throw new Error(`Room sudah memiliki peserta ${role}.`);
        if (!current) db.prepare('INSERT INTO payment_room_members VALUES (?, ?, ?)').run(key, role, accountId);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return { register, login, createSession, current, logout, roomRole, promoteReviewer, assignRoom, close: () => db.close() };
}
