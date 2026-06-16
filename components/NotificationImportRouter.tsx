import { useEffect, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useVault } from '@/contexts/VaultContext';
import * as NotificationListener from '@/modules/notification-listener/src';

/**
 * Mounted once at root level (below providers). Polls for bank notifications
 * captured by BudgetBuddyNotificationService and stored in SharedPreferences.
 *
 * Checks on mount and whenever the app returns to foreground. Forwards the
 * pending text to the expenses form only after the vault is unlocked — same
 * vault-lock-aware pattern as ShareIntentRouter.
 */
export function NotificationImportRouter() {
  const router = useRouter();
  const { status } = useVault();
  const [pendingText, setPendingText] = useState<string | null>(null);

  // Check SharedPreferences on mount and on every foreground resume.
  useEffect(() => {
    const check = () => {
      const text = NotificationListener.getPendingNotification();
      if (text) setPendingText(text);
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  // Show confirmation alert once vault is unlocked.
  useEffect(() => {
    if (!pendingText || status !== 'unlocked') return;
    const preview = pendingText.length > 120 ? pendingText.slice(0, 120) + '…' : pendingText;
    Alert.alert('Gasto capturado', preview, [
      {
        text: 'Ignorar',
        style: 'cancel',
        onPress: () => {
          NotificationListener.clearPendingNotification();
          setPendingText(null);
        },
      },
      {
        text: 'Importar',
        onPress: () => {
          NotificationListener.clearPendingNotification();
          setPendingText(null);
          router.push({ pathname: '/(app)/expenses', params: { shareText: pendingText } });
        },
      },
    ]);
  }, [pendingText, status, router]);

  return null;
}
