import { Buffer } from 'buffer';
import { WORDLIST } from './bip39-wordlist';

// DEK lives only in memory — never persisted to disk
let _dek: ArrayBuffer | null = null;
export const setDek = (d: ArrayBuffer): void => { _dek = d; };
export const getDek = (): ArrayBuffer | null => _dek;
export const clearDek = (): void => { _dek = null; };

// --- Helpers ---
// Buffer.from() instead of btoa/atob (not available in React Native)

export function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(new Uint8Array(buffer)).toString('base64');
}

export function base64ToBuffer(b64: string): ArrayBuffer {
  const buf = Buffer.from(b64, 'base64');
  // Node.js Buffer usa um pool de memória compartilhado: buf.buffer pode ser
  // maior que os bytes que queremos. Usar slice garante que apenas os bytes
  // corretos são expostos (funciona igualmente com o polyfill npm:buffer do RN).
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// Explicit Uint8Array<ArrayBuffer> avoids TypeScript 6 strict-mode errors with crypto.subtle
export function encodeText(str: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(str) as Uint8Array<ArrayBuffer>;
}

export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

export function generateSalt(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength) as Uint8Array<ArrayBuffer>;
  crypto.getRandomValues(bytes);
  return bufferToBase64(bytes.buffer);
}

// --- Key derivation ---

export async function deriveMasterKey(
  password: string,
  uid: string,
  saltBuffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey(
    'raw',
    encodeText(password + uid),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 600_000, hash: 'SHA-256' },
    material,
    256,
  );
}

export async function deriveRecoveryKey(
  mnemonic: string,
  uid: string,
  saltBuffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey(
    'raw',
    encodeText(mnemonic + uid),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 600_000, hash: 'SHA-256' },
    material,
    256,
  );
}

export async function deriveSubKey(
  masterKeyBits: ArrayBuffer,
  info: string,
): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterKeyBits,
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  );
  const salt = new Uint8Array(32) as Uint8Array<ArrayBuffer>;
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encodeText(info) },
    keyMaterial,
    256,
  );
}

export async function deriveAuthVerifier(masterKeyBits: ArrayBuffer): Promise<string> {
  const bits = await deriveSubKey(masterKeyBits, 'verify');
  return bufferToBase64(bits);
}

// --- DEK generation & wrapping ---

export async function generateDEK(): Promise<ArrayBuffer> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  return crypto.subtle.exportKey('raw', key);
}

export async function aesEncrypt(
  keyBits: ArrayBuffer,
  plaintext: Uint8Array<ArrayBuffer> | ArrayBuffer,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = new Uint8Array(12) as Uint8Array<ArrayBuffer>;
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return bufferToBase64(combined.buffer as ArrayBuffer);
}

export async function aesDecrypt(
  keyBits: ArrayBuffer,
  b64Ciphertext: string,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const combined = new Uint8Array(base64ToBuffer(b64Ciphertext)) as Uint8Array<ArrayBuffer>;
  const iv = combined.slice(0, 12) as Uint8Array<ArrayBuffer>;
  const data = combined.slice(12) as Uint8Array<ArrayBuffer>;
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
}

export async function wrapDEK(
  wrapKeyBits: ArrayBuffer,
  dekBits: ArrayBuffer,
): Promise<string> {
  return aesEncrypt(wrapKeyBits, dekBits);
}

export async function unwrapDEK(
  wrapKeyBits: ArrayBuffer,
  wrappedDekB64: string,
): Promise<ArrayBuffer> {
  return aesDecrypt(wrapKeyBits, wrappedDekB64);
}

// --- Field encryption ---

export async function encryptField(
  dekBits: ArrayBuffer,
  value: string | number,
): Promise<string> {
  return aesEncrypt(dekBits, encodeText(String(value)));
}

export async function decryptField(
  dekBits: ArrayBuffer,
  b64Ciphertext: string,
): Promise<string> {
  const buf = await aesDecrypt(dekBits, b64Ciphertext);
  return decodeText(buf);
}

export async function encryptExpenseFields(
  dekBits: ArrayBuffer,
  fields: { description: string; value_usd: number; value_brl: number },
): Promise<{ description_enc: string; value_usd_enc: string; value_brl_enc: string; encrypted: true }> {
  const [description_enc, value_usd_enc, value_brl_enc] = await Promise.all([
    encryptField(dekBits, fields.description),
    encryptField(dekBits, String(fields.value_usd)),
    encryptField(dekBits, String(fields.value_brl)),
  ]);
  return { description_enc, value_usd_enc, value_brl_enc, encrypted: true };
}

type EncryptedExpense = {
  encrypted: boolean;
  description_enc?: string;
  value_usd_enc?: string;
  value_brl_enc?: string;
  [key: string]: unknown;
};

type DecryptedExpense = EncryptedExpense & {
  description: string;
  value_usd: number;
  value_brl: number;
};

export async function decryptExpense(
  dekBits: ArrayBuffer,
  expense: EncryptedExpense,
): Promise<DecryptedExpense> {
  if (!expense.encrypted) {
    return expense as DecryptedExpense;
  }
  try {
    const [description, value_usd_str, value_brl_str] = await Promise.all([
      decryptField(dekBits, expense.description_enc!),
      decryptField(dekBits, expense.value_usd_enc!),
      decryptField(dekBits, expense.value_brl_enc!),
    ]);
    return { ...expense, description, value_usd: parseFloat(value_usd_str), value_brl: parseFloat(value_brl_str) };
  } catch {
    return { ...expense, description: '[Erro de decriptação]', value_usd: 0, value_brl: 0 };
  }
}

export async function decryptExpenses(
  dekBits: ArrayBuffer,
  expenses: EncryptedExpense[],
): Promise<DecryptedExpense[]> {
  return Promise.all(expenses.map(e => decryptExpense(dekBits, e)));
}

// --- BIP-39 Mnemonic ---

function bytesToBits(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(2).padStart(8, '0')).join('');
}

async function entropyToMnemonic(entropy: Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropy));
  const entropyBits = bytesToBits(entropy);
  const checksumLength = entropy.length * 8 / 32;
  const checksumBits = bytesToBits(hash).slice(0, checksumLength);
  const bits = entropyBits + checksumBits;
  const words: string[] = [];
  for (let i = 0; i < bits.length; i += 11) {
    words.push(WORDLIST[parseInt(bits.slice(i, i + 11), 2)]);
  }
  return words.join(' ');
}

export async function generateMnemonicAsync(): Promise<{ mnemonic: string }> {
  const entropy = new Uint8Array(16) as Uint8Array<ArrayBuffer>;
  crypto.getRandomValues(entropy);
  return { mnemonic: await entropyToMnemonic(entropy) };
}

export async function isValidBip39Mnemonic(mnemonic: string): Promise<boolean> {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  if (words.length !== 12) return false;

  const bits = words.map((word) => {
    const index = WORDLIST.indexOf(word);
    if (index === -1) return null;
    return index.toString(2).padStart(11, '0');
  });
  if (bits.some(bit => bit === null)) return false;

  const joinedBits = bits.join('');
  const entropyBits = joinedBits.slice(0, 128);
  const checksumBits = joinedBits.slice(128);
  const entropy = new Uint8Array(16) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < entropy.length; i++) {
    entropy[i] = parseInt(entropyBits.slice(i * 8, i * 8 + 8), 2);
  }

  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropy));
  const expectedChecksum = bytesToBits(hash).slice(0, 4);
  return checksumBits === expectedChecksum;
}

export function validateMnemonic(mnemonic: string): string | null {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  if (words.length !== 12) return 'Deve conter exatamente 12 palavras';
  for (const word of words) {
    if (!WORDLIST.includes(word)) return `"${word}" não é uma palavra BIP-39 válida`;
  }
  return null;
}
