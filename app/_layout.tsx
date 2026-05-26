import '../globals.css';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ShareIntentProvider } from 'expo-share-intent';
import { AuthProvider } from '@/contexts/AuthContext';
import { VaultProvider } from '@/contexts/VaultContext';
import { DataProvider } from '@/contexts/DataContext';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <VaultProvider>
              <DataProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </DataProvider>
            </VaultProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
