/**
 * Testes das funções de criptografia.
 *
 * Usam Node 22's built-in crypto.subtle (globalThis.crypto).
 * PBKDF2 com 600k iterações é lento — timeout definido por describe.
 *
 * O que é verificado:
 *   • round-trips: encrypt→decrypt, wrap→unwrap
 *   • determinismo: mesmos inputs → mesma chave
 *   • unicidade: salts, IVs e mnemonics nunca repetem
 *   • validação BIP-39
 *   • isolamento: DEK errado lança erro
 */

// Buffer polyfill (mesmo que o app usa em index.js)
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

import {
  bufferToBase64,
  base64ToBuffer,
  generateSalt,
  deriveMasterKey,
  deriveSubKey,
  deriveAuthVerifier,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  encryptField,
  decryptField,
  encryptExpenseFields,
  decryptExpense,
  generateMnemonicAsync,
  validateMnemonic,
} from '../lib/crypto';
import { WORDLIST } from '../lib/bip39-wordlist';

// ── Helpers / base64 ──────────────────────────────────────────────────────────

describe('bufferToBase64 / base64ToBuffer', () => {
  it('round-trip preserva todos os bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const b64 = bufferToBase64(original.buffer as ArrayBuffer);
    const restored = new Uint8Array(base64ToBuffer(b64));
    expect(Array.from(restored)).toEqual([0, 1, 127, 128, 255]);
  });

  it('buffer vazio → string vazia → buffer vazio', () => {
    const b64 = bufferToBase64(new ArrayBuffer(0));
    expect(base64ToBuffer(b64).byteLength).toBe(0);
  });
});

// ── generateSalt ──────────────────────────────────────────────────────────────

describe('generateSalt', () => {
  it('decodifica para exatamente N bytes', () => {
    expect(base64ToBuffer(generateSalt(16)).byteLength).toBe(16);
    expect(base64ToBuffer(generateSalt(32)).byteLength).toBe(32);
  });

  it('dois salts são sempre diferentes (aleatório)', () => {
    expect(generateSalt(32)).not.toBe(generateSalt(32));
  });
});

// ── deriveMasterKey ───────────────────────────────────────────────────────────
// PBKDF2 600k iterações: timeout generoso.

describe('deriveMasterKey', () => {
  jest.setTimeout(90_000);

  it('é determinístico com mesmos inputs', async () => {
    const salt = base64ToBuffer(generateSalt(32));
    const k1 = await deriveMasterKey('minha-senha', 'uid-abc', salt);
    const k2 = await deriveMasterKey('minha-senha', 'uid-abc', salt);
    expect(bufferToBase64(k1)).toBe(bufferToBase64(k2));
  });

  it('senha diferente → chave diferente', async () => {
    const salt = base64ToBuffer(generateSalt(32));
    const k1 = await deriveMasterKey('senha-A', 'uid', salt);
    const k2 = await deriveMasterKey('senha-B', 'uid', salt);
    expect(bufferToBase64(k1)).not.toBe(bufferToBase64(k2));
  });

  it('uid diferente → chave diferente (protege contra cross-account)', async () => {
    const salt = base64ToBuffer(generateSalt(32));
    const k1 = await deriveMasterKey('senha', 'uid-1', salt);
    const k2 = await deriveMasterKey('senha', 'uid-2', salt);
    expect(bufferToBase64(k1)).not.toBe(bufferToBase64(k2));
  });

  it('salt diferente → chave diferente', async () => {
    const s1 = base64ToBuffer(generateSalt(32));
    const s2 = base64ToBuffer(generateSalt(32));
    const k1 = await deriveMasterKey('senha', 'uid', s1);
    const k2 = await deriveMasterKey('senha', 'uid', s2);
    expect(bufferToBase64(k1)).not.toBe(bufferToBase64(k2));
  });

  it('produz 32 bytes (256 bits)', async () => {
    const salt = base64ToBuffer(generateSalt(32));
    const k = await deriveMasterKey('senha', 'uid', salt);
    expect(k.byteLength).toBe(32);
  });
});

// ── deriveSubKey / deriveAuthVerifier ─────────────────────────────────────────

describe('deriveSubKey', () => {
  jest.setTimeout(90_000);

  it('"encrypt" e "verify" produzem sub-chaves diferentes', async () => {
    const salt = base64ToBuffer(generateSalt(32));
    const master = await deriveMasterKey('senha', 'uid', salt);
    const enc = await deriveSubKey(master, 'encrypt');
    const ver = await deriveSubKey(master, 'verify');
    expect(bufferToBase64(enc)).not.toBe(bufferToBase64(ver));
  });

  it('deriveAuthVerifier retorna string base64 não-vazia', async () => {
    const salt = base64ToBuffer(generateSalt(32));
    const master = await deriveMasterKey('senha', 'uid', salt);
    const verifier = await deriveAuthVerifier(master);
    expect(typeof verifier).toBe('string');
    expect(verifier.length).toBeGreaterThan(0);
  });
});

// ── generateDEK ───────────────────────────────────────────────────────────────

describe('generateDEK', () => {
  it('retorna 32 bytes (AES-256)', async () => {
    const dek = await generateDEK();
    expect(dek.byteLength).toBe(32);
  });

  it('dois DEKs são sempre diferentes', async () => {
    const d1 = await generateDEK();
    const d2 = await generateDEK();
    expect(bufferToBase64(d1)).not.toBe(bufferToBase64(d2));
  });
});

// ── wrapDEK / unwrapDEK ───────────────────────────────────────────────────────

describe('wrapDEK / unwrapDEK', () => {
  it('round-trip preserva o DEK exatamente', async () => {
    const dek = await generateDEK();
    const wrappingKey = await generateDEK();
    const wrapped = await wrapDEK(wrappingKey, dek);
    const restored = await unwrapDEK(wrappingKey, wrapped);
    expect(bufferToBase64(dek)).toBe(bufferToBase64(restored));
  });

  it('unwrap com chave errada lança erro (GCM tag inválida)', async () => {
    const dek = await generateDEK();
    const key1 = await generateDEK();
    const key2 = await generateDEK();
    const wrapped = await wrapDEK(key1, dek);
    await expect(unwrapDEK(key2, wrapped)).rejects.toThrow();
  });

  it('wrapped é string base64 diferente a cada chamada (IV aleatório)', async () => {
    const dek = await generateDEK();
    const wrappingKey = await generateDEK();
    const w1 = await wrapDEK(wrappingKey, dek);
    const w2 = await wrapDEK(wrappingKey, dek);
    expect(w1).not.toBe(w2);
  });
});

// ── encryptField / decryptField ───────────────────────────────────────────────

describe('encryptField / decryptField', () => {
  let dek: ArrayBuffer;
  beforeAll(async () => { dek = await generateDEK(); });

  it('round-trip com texto em português', async () => {
    const plain = 'Almoço no restaurante São Paulo';
    expect(await decryptField(dek, await encryptField(dek, plain))).toBe(plain);
  });

  it('round-trip com número (float)', async () => {
    const n = 1234.56;
    const dec = await decryptField(dek, await encryptField(dek, n));
    expect(parseFloat(dec)).toBeCloseTo(n, 5);
  });

  it('string vazia funciona', async () => {
    const dec = await decryptField(dek, await encryptField(dek, ''));
    expect(dec).toBe('');
  });

  it('dois cifrados do mesmo texto são diferentes (IV aleatório)', async () => {
    const enc1 = await encryptField(dek, 'texto igual');
    const enc2 = await encryptField(dek, 'texto igual');
    expect(enc1).not.toBe(enc2);
  });

  it('decriptar com DEK diferente lança erro', async () => {
    const dek2 = await generateDEK();
    const enc = await encryptField(dek, 'segredo');
    await expect(decryptField(dek2, enc)).rejects.toThrow();
  });
});

// ── encryptExpenseFields / decryptExpense ─────────────────────────────────────

describe('encryptExpenseFields / decryptExpense', () => {
  it('round-trip completo de um gasto', async () => {
    const dek = await generateDEK();
    const fields = {
      description: 'Uber para o trabalho',
      value_usd: 5.50,
      value_brl: 27.80,
    };
    const enc = await encryptExpenseFields(dek, fields);

    // encryptExpenseFields marca encrypted: true
    expect(enc.encrypted).toBe(true);

    const expense = {
      expense_id: 'test-id',
      date: '2025-01-10',
      category_id: null,
      created_at: '2025-01-10T12:00:00Z',
      ...enc,
    };
    const dec = await decryptExpense(dek, expense);

    expect(dec.description).toBe(fields.description);
    expect(dec.value_usd).toBeCloseTo(fields.value_usd, 5);
    expect(dec.value_brl).toBeCloseTo(fields.value_brl, 5);
  });

  it('decryptExpense com gasto não-encriptado retorna campos diretamente', async () => {
    const dek = await generateDEK();
    const expense = {
      expense_id: 'e2',
      date: '2025-01-01',
      category_id: null,
      encrypted: false,
      description: 'Gasto legado',
      value_usd: 0,
      value_brl: 50,
      created_at: '',
    };
    const dec = await decryptExpense(dek, expense as any);
    expect(dec.description).toBe('Gasto legado');
    expect(dec.value_brl).toBe(50);
  });
});

// ── generateMnemonicAsync ─────────────────────────────────────────────────────

describe('generateMnemonicAsync', () => {
  it('retorna exatamente 12 palavras', async () => {
    const { mnemonic } = await generateMnemonicAsync();
    expect(mnemonic.split(' ')).toHaveLength(12);
  });

  it('todas as palavras estão no wordlist BIP-39', async () => {
    const { mnemonic } = await generateMnemonicAsync();
    for (const word of mnemonic.split(' ')) {
      expect(WORDLIST).toContain(word);
    }
  });

  it('dois mnemonics gerados são sempre diferentes', async () => {
    const { mnemonic: m1 } = await generateMnemonicAsync();
    const { mnemonic: m2 } = await generateMnemonicAsync();
    expect(m1).not.toBe(m2);
  });
});

// ── validateMnemonic ──────────────────────────────────────────────────────────

describe('validateMnemonic', () => {
  it('retorna null para mnemonic com 12 palavras válidas', async () => {
    const { mnemonic } = await generateMnemonicAsync();
    expect(validateMnemonic(mnemonic)).toBeNull();
  });

  it('retorna erro se tiver menos de 12 palavras', () => {
    const { 0: first } = WORDLIST;
    expect(validateMnemonic(`${first} ${first}`)).not.toBeNull();
  });

  it('retorna erro se tiver mais de 12 palavras', () => {
    const words = Array(13).fill(WORDLIST[0]).join(' ');
    expect(validateMnemonic(words)).not.toBeNull();
  });

  it('retorna erro se contiver palavra fora do wordlist', () => {
    const { mnemonic } = { mnemonic: Array(12).fill(WORDLIST[0]).join(' ') };
    const withBadWord = mnemonic.split(' ');
    withBadWord[6] = 'naoexistenawordlist';
    expect(validateMnemonic(withBadWord.join(' '))).not.toBeNull();
  });

  it('aceita mnemonic com espaços extras (normalização)', () => {
    const { mnemonic } = { mnemonic: Array(12).fill(WORDLIST[0]).join('  ') };
    // validateMnemonic usa trim().split(/\s+/), então deve aceitar
    expect(validateMnemonic(mnemonic)).toBeNull();
  });

  it('aceita mnemonic em maiúsculas (normalização)', () => {
    const upper = Array(12).fill(WORDLIST[0].toUpperCase()).join(' ');
    // validateMnemonic faz toLowerCase internamente
    expect(validateMnemonic(upper)).toBeNull();
  });
});

// ── wordlist BIP-39 ───────────────────────────────────────────────────────────

describe('WORDLIST BIP-39', () => {
  it('tem exactamente 2048 palavras (padrão BIP-39)', () => {
    expect(WORDLIST.length).toBe(2048);
  });

  it('não tem palavras duplicadas', () => {
    const unique = new Set(WORDLIST);
    expect(unique.size).toBe(WORDLIST.length);
  });

  it('todas as entradas são strings não-vazias', () => {
    for (const word of WORDLIST) {
      expect(typeof word).toBe('string');
      expect(word.length).toBeGreaterThan(0);
    }
  });

  it('todas as palavras são minúsculas (sem espaços)', () => {
    for (const word of WORDLIST) {
      expect(word).toBe(word.toLowerCase().trim());
    }
  });
});
