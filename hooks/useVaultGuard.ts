import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';

export function useVaultGuard() {
  const router = useRouter();
  const { user } = useAuth();
  const { status } = useVault();

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    } else if (status === 'setup_needed') {
      router.replace('/(vault)/setup');
    } else if (status === 'locked') {
      router.replace('/(vault)/unlock');
    }
  }, [user, status]);
}
