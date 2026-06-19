import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';

export default function Index() {
  const { user, restoring } = useAuth();
  const { status } = useVault();

  // 1. Wait for Google silent sign-in to finish
  if (restoring) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  // 2. No user → go to login (vault status is irrelevant)
  if (!user) return <Redirect href="/login" />;

  // 3. User exists → wait for vault check against Drive
  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (status === 'setup_needed') return <Redirect href="/(vault)/setup" />;
  if (status === 'locked') return <Redirect href="/(vault)/unlock" />;
  return <Redirect href="/(app)/dashboard" />;
}
