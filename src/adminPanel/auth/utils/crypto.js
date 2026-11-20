import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

export const hashPassword = async (password) => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
};

export const verifyPassword = async (password, storedHash) => {
  const [algorithm, salt, keyHex] = (storedHash || '').split(':');
  if (algorithm !== 'scrypt' || !salt || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const hashValue = (value) => {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret) throw new Error('ADMIN_AUTH_SECRET must be configured');
  return createHmac('sha256', secret).update(value).digest('hex');
};

export const createOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

const base64url = (value) => Buffer.from(value).toString('base64url');

export const createAccessToken = (adminId) => {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret) throw new Error('ADMIN_AUTH_SECRET must be configured');

  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ sub: adminId, iat: now, exp: now + 60 * 60 * 8 }));
  const unsignedToken = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${payload}`;
  const signature = createHmac('sha256', secret).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${signature}`;
};

export const verifyAccessToken = (token) => {
  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', secret).update(unsignedToken).digest();
  let actual;
  try {
    actual = Buffer.from(parts[2], 'base64url');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.sub || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  } catch {
    return null;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? parts[1] : null;
};

export const decodeTokenSubject = (token) => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub;
  } catch {
    return null;
  }
};
