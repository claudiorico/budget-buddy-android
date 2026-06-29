import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as LocalAuth from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { storage } from '@/lib/storage';

const SS_KEY = 'vault_password_biometric';
const MMKV_FLAG = 'biometric_unlock_enabled';
const BIOMETRIC_TIMEOUT_MS = 25000;

export type BiometricSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  primaryType: 'fingerprint' | 'face' | 'iris' | 'none';
};

export async function checkBiometricSupport(): Promise<BiometricSupport> {
  const hasHardware = await LocalAuth.hasHardwareAsync();
  const isEnrolled = hasHardware ? await LocalAuth.isEnrolledAsync() : false;
  let primaryType: BiometricSupport['primaryType'] = 'none';

  if (isEnrolled) {
    const types = await LocalAuth.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuth.AuthenticationType.FINGERPRINT)) primaryType = 'fingerprint';
    else if (types.includes(LocalAuth.AuthenticationType.FACIAL_RECOGNITION)) primaryType = 'face';
    else if (types.includes(LocalAuth.AuthenticationType.IRIS)) primaryType = 'iris';
  }

  return { hasHardware, isEnrolled, primaryType };
}

async function authenticateUser(reason: string): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    const auth = LocalAuth.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar senha do aparelho',
      disableDeviceFallback: false,
    });

    const timeoutPromise = new Promise<false>((resolve) => {
      timeout = setTimeout(() => {
        if (Platform.OS === 'android') {
          LocalAuth.cancelAuthenticate().catch(() => {});
        }
        resolve(false);
      }, BIOMETRIC_TIMEOUT_MS);
    });

    const res = await Promise.race([auth, timeoutPromise]);
    return typeof res === 'boolean' ? res : res.success;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function unlockWithBiometric(): Promise<string | null> {
  const ok = await authenticateUser('Desbloquear cofre');
  if (!ok) return null;

  try {
    return await SecureStore.getItemAsync(SS_KEY, {
      keychainService: 'budget-buddy-vault',
    });
  } catch {
    return null;
  }
}

export async function cancelBiometricAuthentication(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await LocalAuth.cancelAuthenticate();
  } catch { /* ignore */ }
}

export function useBiometricVault() {
  const [enabled, setEnabledState] = useState<boolean>(() =>
    storage.getBoolean(MMKV_FLAG) ?? false,
  );
  const [support, setSupport] = useState<BiometricSupport>({
    hasHardware: false,
    isEnrolled: false,
    primaryType: 'none',
  });

  const refreshSupport = useCallback(async (): Promise<BiometricSupport> => {
    const next = await checkBiometricSupport();
    setSupport(next);
    return next;
  }, []);

  useEffect(() => {
    refreshSupport();
  }, [refreshSupport]);

  const enable = useCallback(async (password: string): Promise<boolean> => {
    const currentSupport = await refreshSupport();
    if (!currentSupport.hasHardware || !currentSupport.isEnrolled) return false;

    const ok = await authenticateUser('Confirmar para ativar desbloqueio por digital');
    if (!ok) return false;

    try {
      try {
        await SecureStore.deleteItemAsync(SS_KEY, {
          keychainService: 'budget-buddy-vault',
        });
      } catch { /* ignore stale item */ }

      await SecureStore.setItemAsync(SS_KEY, password, {
        keychainService: 'budget-buddy-vault',
      });
      storage.set(MMKV_FLAG, true);
      setEnabledState(true);
      return true;
    } catch {
      return false;
    }
  }, [refreshSupport]);

  const disable = useCallback(async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(SS_KEY, {
        keychainService: 'budget-buddy-vault',
      });
    } catch { /* ignore */ }
    storage.remove(MMKV_FLAG);
    setEnabledState(false);
  }, []);

  return { enabled, support, refreshSupport, enable, disable };
}
