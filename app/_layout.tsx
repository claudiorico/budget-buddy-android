import '../globals.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ShareIntentProvider } from 'expo-share-intent';
import { AuthProvider } from '@/contexts/AuthContext';
import { VaultProvider } from '@/contexts/VaultContext';
import { DataProvider } from '@/contexts/DataContext';
import { ShareIntentRouter } from '@/components/ShareIntentRouter';
import { NotificationImportRouter } from '@/components/NotificationImportRouter';
import { useThemeBootstrap } from '@/hooks/useTheme';

export { ErrorBoundary } from 'expo-router';

// Apply persisted theme preference at mount. Returns null, no re-render side-effects.
function ThemeBootstrap() {
  useThemeBootstrap();
  return null;
}

// Isolated so re-renders from color scheme changes don't remount the <Stack>.
function ThemedStatusBar() {
  const { colorScheme } = useColorScheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <ShareIntentProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <VaultProvider>
              <DataProvider>
                <ThemeBootstrap />
                <ThemedStatusBar />
                <ShareIntentRouter />
                <NotificationImportRouter />
                <Stack screenOptions={{ headerShown: false }} />
              </DataProvider>
            </VaultProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
