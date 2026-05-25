import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';

export default function Index() {
  const { user, restoring } = useAuth();
  const { status } = useVault();

  // Wait for session restore and vault check
  if (restoring || status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (status === 'setup_needed') return <Redirect href="/(vault)/setup" />;
  if (status === 'locked') return <Redirect href="/(vault)/unlock" />;
  return <Redirect href="/(app)/dashboard" />;
}
