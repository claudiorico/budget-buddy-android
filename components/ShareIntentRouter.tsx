import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useVault } from '@/contexts/VaultContext';

/**
 * Mounted once at the root, below the providers, so it survives every route
 * change (index → unlock → app group). It captures an incoming Android share
 * (ACTION_SEND) the instant it arrives — even while the vault is still locked —
 * and only forwards it to the expenses form once the vault is unlocked.
 *
 * Why not read the share intent in `index.tsx`? `index` unmounts the moment it
 * redirects to the unlock screen, and after unlocking the app navigates
 * straight to the dashboard without ever returning to `index`. So a share that
 * arrived while locked (the primary scenario: app cold-started from a bank
 * notification) was silently dropped.
 */
export function ShareIntentRouter() {
  const router = useRouter();
  const { status } = useVault();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const [pendingText, setPendingText] = useState<string | null>(null);

  // 1. Capture the shared text the moment it lands, regardless of vault state.
  useEffect(() => {
    console.log('[ShareIntentRouter] hasShareIntent=', hasShareIntent, 'text=', shareIntent?.text);
    if (!hasShareIntent) return;
    const text = shareIntent.text ?? shareIntent.webUrl ?? '';
    if (text.trim()) setPendingText(text);
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  // 2. Show confirmation alert once vault unlocks — only after the vault unlocks.
  useEffect(() => {
    console.log('[ShareIntentRouter] pendingText=', pendingText, 'status=', status);
    if (!pendingText || status !== 'unlocked') return;
    const preview = pendingText.length > 120 ? pendingText.slice(0, 120) + '…' : pendingText;
    Alert.alert('Gasto capturado', preview, [
      {
        text: 'Ignorar',
        style: 'cancel',
        onPress: () => setPendingText(null),
      },
      {
        text: 'Importar',
        onPress: () => {
          setPendingText(null);
          router.push({ pathname: '/(app)/expenses', params: { shareText: pendingText } });
        },
      },
    ]);
  }, [pendingText, status, router]);

  return null;
}
