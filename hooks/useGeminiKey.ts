import { useCallback, useState } from 'react';
import {
  getStoredApiKey, setStoredApiKey, clearStoredApiKey,
} from '@/lib/ai';

export function useGeminiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(() => getStoredApiKey());

  const setApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      setStoredApiKey(trimmed);
      setApiKeyState(trimmed);
    } else {
      clearStoredApiKey();
      setApiKeyState(null);
    }
  }, []);

  const clearKey = useCallback(() => {
    clearStoredApiKey();
    setApiKeyState(null);
  }, []);

  return {
    apiKey,
    hasKey: !!apiKey,
    setApiKey,
    clearKey,
  };
}
