import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';
import { strFromU8, strToU8 } from 'fflate';
import { decodeBase64, encodeBase64 } from './encoding.ts';

export const BACKUP_LIMIT = 48 * 1024 * 1024;
export const BACKUP_FILE_LIMIT = 68 * 1024 * 1024;
export const BACKUP_ITERATIONS = 600_000;
export type StoreRecord = { version: number; state: Record<string, unknown> };
export type BackupAttachment = { kind: 'bank' | 'photo'; id: string; name: string; sha256: string; base64: string; metadata?: Record<string, unknown> };
export type BackupPayload = { format: 'gasfinder-data'; version: 1; createdAt: string; appVersion: string; stores: Record<string, StoreRecord>; archives: Record<string, unknown>[]; attachments: BackupAttachment[]; includesFiles: boolean; attachmentScope?: 'all' | 'available' | 'none' };
export type BackupEnvelope = { format: 'gasfinder-encrypted'; version: 1; kdf: 'PBKDF2-SHA256'; iterations: number; cipher: 'AES-256-GCM'; salt: string; nonce: string; ciphertext: string };
const aad = strToU8('gasfinder-encrypted:1:PBKDF2-SHA256:600000:AES-256-GCM');
export const digestBytes = (bytes: Uint8Array) => Array.from(sha256(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

export function validateJson(value: unknown, depth = 0, budget = { remaining: 500_000 }): void {
  if (--budget.remaining < 0 || depth > 30) throw new Error('Backup has too many records or nested fields.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Backup contains invalid numbers.'); return; }
  if (typeof value === 'string') { if (value.length > BACKUP_LIMIT) throw new Error('Backup field is too large.'); return; }
  if (Array.isArray(value)) { if (value.length > 100_000) throw new Error('Backup contains too many rows.'); value.forEach(item => validateJson(item, depth + 1, budget)); return; }
  if (!value || typeof value !== 'object') throw new Error('Backup contains unsupported data.');
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Backup contains unsafe fields.');
    if (/Cents$/.test(key) && item !== null && (!Number.isSafeInteger(item) || typeof item !== 'number')) throw new Error('Backup contains an invalid money amount.');
    validateJson(item, depth + 1, budget);
  }
}
export function validateBackup(value: unknown): BackupPayload {
  validateJson(value);
  const data = value as BackupPayload;
  if (!data || data.format !== 'gasfinder-data' || data.version !== 1 || !Number.isFinite(Date.parse(data.createdAt)) || typeof data.appVersion !== 'string' || typeof data.includesFiles !== 'boolean' || !data.stores || typeof data.stores !== 'object' || Array.isArray(data.stores) || !Array.isArray(data.archives) || !Array.isArray(data.attachments)) throw new Error('Unsupported or damaged Savemage backup.');
  if (data.attachmentScope && !['all','available','none'].includes(data.attachmentScope)) throw new Error('Unsupported attachment scope.');
  if (data.attachmentScope === 'none' && data.includesFiles || data.attachmentScope && data.attachmentScope !== 'none' && !data.includesFiles) throw new Error('Attachment scope is inconsistent.');
  if (!data.includesFiles && data.attachments.length) throw new Error('Backup attachment choice is inconsistent.');
  const ids = new Set<string>();
  let totalBytes = 0;
  for (const attachment of data.attachments) {
    if (!attachment || !['bank', 'photo'].includes(attachment.kind) || typeof attachment.id !== 'string' || !attachment.id || typeof attachment.name !== 'string' || typeof attachment.base64 !== 'string' || !/^[a-f0-9]{64}$/.test(attachment.sha256)) throw new Error('Backup has an invalid attachment.');
    const key = `${attachment.kind}:${attachment.id}`;
    if (ids.has(key)) throw new Error('Backup contains duplicate attachments.');
    ids.add(key);
    const bytes = decodeBase64(attachment.base64, BACKUP_LIMIT); totalBytes += bytes.length;
    if (totalBytes > 30 * 1024 * 1024) throw new Error('Backup attachments exceed 30 MB.');
    if (digestBytes(bytes) !== attachment.sha256) throw new Error('An attachment failed its checksum. Nothing was restored.');
  }
  return data;
}
export async function encryptBackup(data: BackupPayload, password: string, random: (count: number) => Promise<Uint8Array>): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new Error('Use a backup password from 12 to 1,024 characters.');
  const plaintext = strToU8(JSON.stringify(validateBackup(data)));
  if (plaintext.length > BACKUP_LIMIT) throw new Error('Backup exceeds 48 MB. Export records only, or export originals separately.');
  const salt = await random(16), nonce = await random(12);
  if (salt.length !== 16 || nonce.length !== 12) throw new Error('Secure random generation is unavailable.');
  const passwordBytes = strToU8(password);
  const key = await pbkdf2Async(sha256, passwordBytes, salt, { c: BACKUP_ITERATIONS, dkLen: 32, asyncTick: 10 });
  try {
    const envelope: BackupEnvelope = { format: 'gasfinder-encrypted', version: 1, kdf: 'PBKDF2-SHA256', iterations: BACKUP_ITERATIONS, cipher: 'AES-256-GCM', salt: encodeBase64(salt), nonce: encodeBase64(nonce), ciphertext: encodeBase64(gcm(key, nonce, aad).encrypt(plaintext)) };
    return JSON.stringify(envelope);
  } finally { key.fill(0); passwordBytes.fill(0); plaintext.fill(0); }
}
export async function decryptBackup(text: string, password: string): Promise<BackupPayload> {
  if (text.length > BACKUP_FILE_LIMIT || password.length > 1024) throw new Error('Backup file or password is too large.');
  let envelope: BackupEnvelope;
  try { envelope = JSON.parse(text); } catch { throw new Error('This is not a readable Savemage backup.'); }
  if (envelope?.format !== 'gasfinder-encrypted' || envelope.version !== 1 || envelope.kdf !== 'PBKDF2-SHA256' || envelope.iterations !== BACKUP_ITERATIONS || envelope.cipher !== 'AES-256-GCM' || typeof envelope.salt !== 'string' || typeof envelope.nonce !== 'string' || typeof envelope.ciphertext !== 'string') throw new Error('Unsupported backup version or encryption format.');
  const salt = decodeBase64(envelope.salt, 16), nonce = decodeBase64(envelope.nonce, 12), ciphertext = decodeBase64(envelope.ciphertext, BACKUP_LIMIT + 16);
  if (salt.length !== 16 || nonce.length !== 12 || ciphertext.length < 16) throw new Error('Damaged backup encryption header.');
  const passwordBytes = strToU8(password);
  const key = await pbkdf2Async(sha256, passwordBytes, salt, { c: BACKUP_ITERATIONS, dkLen: 32, asyncTick: 10 });
  let plaintext: Uint8Array;
  try { plaintext = gcm(key, nonce, aad).decrypt(ciphertext); }
  catch { throw new Error('Wrong password or damaged backup. Your current data has not changed.'); }
  finally { key.fill(0); passwordBytes.fill(0); }
  try { return validateBackup(JSON.parse(strFromU8(plaintext))); }
  finally { plaintext.fill(0); }
}
