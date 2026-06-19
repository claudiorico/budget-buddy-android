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
 * pending text to the expenses form only after the vault is unlocked.
 */
export function NotificationImportRouter() {
  const router = useRouter();
  const { status } = useVault();
  const [queue, setQueue] = useState<string[]>([]);

  // Check SharedPreferences on mount and on every foreground resume.
  useEffect(() => {
    const check = () => {
      const items = NotificationListener.getPendingNotifications();
      if (items.length) setQueue(items);
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  // Show one confirmation alert at a time, in order, once vault is unlocked.
  useEffect(() => {
    if (queue.length === 0 || status !== 'unlocked') return;
    const [current, ...rest] = queue;
    const preview = current.length > 120 ? current.slice(0, 120) + '…' : current;
    const title = queue.length > 1 ? `Gasto capturado (1 de ${queue.length})` : 'Gasto capturado';
    Alert.alert(title, preview, [
      {
        text: 'Ignorar',
        style: 'cancel',
        onPress: () => {
          NotificationListener.removePendingNotification(current);
          setQueue(rest);
        },
      },
      {
        text: 'Importar',
        onPress: () => {
          NotificationListener.removePendingNotification(current);
          setQueue(rest);
          router.push({ pathname: '/(app)/expenses', params: { shareText: current } });
        },
      },
    ]);
  }, [queue, status, router]);

  return null;
}
