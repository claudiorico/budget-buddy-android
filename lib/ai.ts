import { GoogleGenAI, Type } from '@google/genai';
import * as SecureStore from 'expo-secure-store';
import { storage } from './storage';

const KEY_STORAGE_KEY = 'gemini_api_key';
const LEGACY_KEY_STORAGE_KEY = KEY_STORAGE_KEY;
// gemini-2.5-flash-lite tem free tier ativo (15 RPM, 1500 RPD).
// gemini-2.0-flash saiu do free tier em vários projetos novos (quota=0).
const MODEL = 'gemini-2.5-flash-lite';

export type ExpenseDraft = {
  description: string;
  value_brl: number;
  value_usd: number;
  date: string;
  category_id: string | null;
  _confidence: 'high' | 'low';
};

export type CategoryHint = {
  category_id: string;
  name: string;
};

export class MissingApiKeyError extends Error {
  constructor() {
    super('Gemini API key not configured');
    this.name = 'MissingApiKeyError';
  }
}

export class GeminiApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
  }
}

/** Maps raw Gemini errors (often huge JSON blobs) to short, user-friendly messages. */
function friendlyGeminiError(err: unknown): GeminiApiError | null {
  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/"code"\s*:\s*(\d{3})/) ?? msg.match(/\b(4\d{2}|5\d{2})\b/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;

  if (status === 429 || /RATE_LIMIT_EXCEEDED|quota/i.test(msg)) {
    return new GeminiApiError(429,
      'Cota do Gemini atingida ou indisponível neste modelo. Aguarde alguns minutos ou troque a chave em Perfil → Configurar IA.',
    );
  }
  if (status === 401 || status === 403 || /API_KEY|API key|unauthorized|permission/i.test(msg)) {
    return new GeminiApiError(status || 401,
      'Chave Gemini inválida ou sem permissão. Confira em Perfil → Configurar IA.',
    );
  }
  if (status === 400) {
    return new GeminiApiError(400, 'Requisição rejeitada pelo Gemini. Tente um texto mais simples.');
  }
  if (status >= 500) {
    return new GeminiApiError(status, 'Servidor do Gemini indisponível. Tente novamente em instantes.');
  }
  return null;
}

export async function getStoredApiKey(): Promise<string | null> {
  const secureKey = await SecureStore.getItemAsync(KEY_STORAGE_KEY);
  if (secureKey) return secureKey;

  const legacyKey = storage.getString(LEGACY_KEY_STORAGE_KEY);
  if (!legacyKey) return null;

  await SecureStore.setItemAsync(KEY_STORAGE_KEY, legacyKey);
  storage.remove(LEGACY_KEY_STORAGE_KEY);
  return legacyKey;
}

export async function setStoredApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_STORAGE_KEY, key.trim());
  storage.remove(LEGACY_KEY_STORAGE_KEY);
}

export async function clearStoredApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_STORAGE_KEY);
  storage.remove(KEY_STORAGE_KEY);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildPrompt(text: string, categories: CategoryHint[]): string {
  const today = todayIso();
  const catList = categories.length
    ? categories.map(c => `- ${c.category_id} → ${c.name}`).join('\n')
    : '(nenhuma categoria disponível — devolva category_id: null)';

  return `Você extrai dados de gastos a partir de texto livre em português brasileiro.
Hoje é ${today}.

Texto do usuário:
"""
${text}
"""

Categorias disponíveis (use o category_id exato ou null se nada combinar):
${catList}

Regras:
- "description": frase curta (até 40 caracteres), capitalize a primeira letra.
- "value_brl": número decimal em reais. Aceite "45,90", "R$ 45,90", "45 reais", "45.9". Se não houver valor, devolva 0.
- "value_usd": 0 a menos que o texto mencione explicitamente dólar/USD.
- "date": formato ISO AAAA-MM-DD. "hoje" = ${today}. "ontem" = ontem. "15/03" = mês 03 do ano atual.
- "category_id": escolha por similaridade semântica (uber→transporte, almoço→alimentação, etc). Devolva null se não tiver certeza.
- "_confidence": "low" se você chutou algum campo OU o texto está ambíguo; "high" só se TUDO veio do texto sem chute.`;
}

export async function parseExpenseFromText(
  text: string,
  categories: CategoryHint[],
): Promise<ExpenseDraft> {
  const apiKey = await getStoredApiKey();
  if (!apiKey) throw new MissingApiKeyError();

  const ai = new GoogleGenAI({ apiKey });

  let response;
  try {
    response = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(text, categories),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            value_brl: { type: Type.NUMBER },
            value_usd: { type: Type.NUMBER },
            date: { type: Type.STRING },
            category_id: { type: Type.STRING, nullable: true },
            _confidence: { type: Type.STRING, enum: ['high', 'low'] },
          },
          required: ['description', 'value_brl', 'value_usd', 'date', '_confidence'],
        },
        temperature: 0.1,
      },
    });
  } catch (e) {
    const friendly = friendlyGeminiError(e);
    if (friendly) throw friendly;
    throw e;
  }

  const raw = response.text;
  if (!raw) throw new Error('Resposta vazia do Gemini');

  const parsed = JSON.parse(raw) as ExpenseDraft;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    parsed.date = todayIso();
    parsed._confidence = 'low';
  }
  if (typeof parsed.value_brl !== 'number' || isNaN(parsed.value_brl)) {
    parsed.value_brl = 0;
    parsed._confidence = 'low';
  }
  if (typeof parsed.value_usd !== 'number' || isNaN(parsed.value_usd)) {
    parsed.value_usd = 0;
  }
  if (parsed.category_id === undefined) parsed.category_id = null;

  return parsed;
}
