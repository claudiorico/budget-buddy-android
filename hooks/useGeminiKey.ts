import { useCallback, useEffect, useState } from 'react';
import {
  getStoredApiKey, setStoredApiKey, clearStoredApiKey,
} from '@/lib/ai';

let cachedKey: string | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
const listeners = new Set<(key: string | null) => void>();

function publish(key: string | null) {
  cachedKey = key;
  listeners.forEach(l => l(key));
}

function ensureInit(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (!initPromise) {
    initPromise = getStoredApiKey().then(k => {
      cachedKey = k;
      initialized = true;
      listeners.forEach(l => l(k));
    });
  }
  return initPromise;
}

export function useGeminiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(cachedKey);
  const [loading, setLoading] = useState(!initialized);

  useEffect(() => {
    const listener = (k: string | null) => setApiKeyState(k);
    listeners.add(listener);

    let alive = true;
    ensureInit().finally(() => {
      if (alive) {
        setApiKeyState(cachedKey);
        setLoading(false);
      }
    });

    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      await setStoredApiKey(trimmed);
      publish(trimmed);
    } else {
      await clearStoredApiKey();
      publish(null);
    }
  }, []);

  const clearKey = useCallback(async () => {
    await clearStoredApiKey();
    publish(null);
  }, []);

  return {
    apiKey,
    hasKey: !!apiKey,
    loading,
    setApiKey,
    clearKey,
  };
}
