import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import * as drive from '@/lib/drive';

export function useDrive() {
  const { getAccessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T>(fn: (token: string) => Promise<T>): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      return await fn(token);
    } catch (e: any) {
      setError(e.message ?? 'Drive error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { run, loading, error };
}
