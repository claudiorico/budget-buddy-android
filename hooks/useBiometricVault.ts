import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as LocalAuth from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { storage } from '@/lib/storage';

// Senha do cofre guardada no Android Keystore protegida por biometria.
// Quando requireAuthentication: true, o Keystore só libera o valor após o
// usuário autenticar via digital/face. A senha nunca toca disco em plaintext.
const SS_KEY = 'vault_password_biometric';
// Flag em MMKV indica se o usuário ativou o desbloqueio biométrico.
// Permite UI mostrar/esconder o botão "Usar digital" sem chamar SecureStore.
const MMKV_FLAG = 'biometric_unlock_enabled';
const BIOMETRIC_TIMEOUT_MS = 25000;

export type BiometricSupport = {
  hasHardware: boolean;
  isEnrolled: boolean;
  /** Resumo amigável para UI: 'fingerprint' | 'face' | 'iris' | 'none' */
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

/** Returns the stored password if biometric auth succeeds, else null. */
export async function unlockWithBiometric(): Promise<string | null> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const readPassword = SecureStore.getItemAsync(SS_KEY, {
      requireAuthentication: true,
      authenticationPrompt: 'Desbloquear cofre',
      keychainService: 'budget-buddy-vault',
    });
    const timeoutPromise = new Promise<null>((resolve) => {
      timeout = setTimeout(() => {
        if (Platform.OS === 'android') {
          LocalAuth.cancelAuthenticate().catch(() => {});
        }
        resolve(null);
      }, BIOMETRIC_TIMEOUT_MS);
    });

    const pwd = await Promise.race([readPassword, timeoutPromise]);
    return pwd ?? null;
  } catch {
    // Cancelou, biometria falhou, ou item não existe.
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
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
    hasHardware: false, isEnrolled: false, primaryType: 'none',
  });

  const refreshSupport = useCallback(async (): Promise<BiometricSupport> => {
    const next = await checkBiometricSupport();
    setSupport(next);
    return next;
  }, []);

  useEffect(() => {
    refreshSupport();
  }, [refreshSupport]);

  /** Saves password under biometric protection. Returns true on success. */
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
        requireAuthentication: true,
        authenticationPrompt: 'Desbloquear cofre',
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
