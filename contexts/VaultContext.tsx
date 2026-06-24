import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import {
  deriveMasterKey, deriveSubKey, deriveRecoveryKey,
  deriveAuthVerifier, generateDEK, wrapDEK, unwrapDEK,
  generateSalt, generateMnemonicAsync, base64ToBuffer,
  setDek, clearDek, getDek,
} from '@/lib/crypto';
import { validateMnemonic } from '@/lib/crypto';
import * as drive from '@/lib/drive';

// ── Types ────────────────────────────────────────────────────────────────────

export type VaultStatus = 'loading' | 'setup_needed' | 'locked' | 'unlocked';

export type VaultDoc = {
  salt: string;
  auth_verifier: string;
  wrapped_dek: string;
  recovery_salt: string;
  wrapped_dek_recovery: string;
  created_at: string;
};

type VaultContextType = {
  status: VaultStatus;
  vaultDoc: VaultDoc | null;
  /** Increments whenever DEK changes — lets DataContext know to re-decrypt */
  dekVersion: number;
  setupVault: (password: string) => Promise<string>;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => void;
  recoverVault: (mnemonic: string, newPassword: string) => Promise<boolean>;
  regenerateRecoveryKey: (password: string) => Promise<string | null>;
  deleteVaultAndDriveData: () => Promise<void>;
  setAutoLockPaused: (paused: boolean) => void;
};

// ── Context ──────────────────────────────────────────────────────────────────

const VaultContext = createContext<VaultContextType | null>(null);

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error('useVault must be inside VaultProvider');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken } = useAuth();

  const [status, setStatus] = useState<VaultStatus>('loading');
  const [vaultDoc, setVaultDoc] = useState<VaultDoc | null>(null);
  const [dekVersion, setDekVersion] = useState(0);
  const [autoLockPaused, setAutoLockPaused] = useState(false);

  const bumpDek = () => setDekVersion(v => v + 1);

  // ── On user change: check Drive for vault.json ─────────────────────────────

  useEffect(() => {
    if (!user) {
      clearDek();
      bumpDek();
      setStatus('loading');
      setVaultDoc(null);
      return;
    }

    (async () => {
      setStatus('loading');
      try {
        const token = await getAccessToken();
        // Populate MMKV file-ID cache (best-effort)
        try { await drive.syncFileIds(token); } catch { /* ignore */ }

        const doc = await drive.readFile<VaultDoc>(token, 'vault.json');
        if (doc) {
          setVaultDoc(doc);
          setStatus('locked');
        } else {
          setStatus('setup_needed');
        }
      } catch {
        // Network error — if vault was previously loaded keep it, otherwise assume locked
        setStatus(vaultDoc ? 'locked' : 'setup_needed');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── setupVault ─────────────────────────────────────────────────────────────

  const setupVault = useCallback(async (password: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');

    const saltB64 = generateSalt(32);
    const recoverySaltB64 = generateSalt(32);
    const saltBuf = base64ToBuffer(saltB64);
    const recoverySaltBuf = base64ToBuffer(recoverySaltB64);

    const masterKeyBits = await deriveMasterKey(password, user.id, saltBuf);
    const encKeyBits = await deriveSubKey(masterKeyBits, 'encrypt');
    const authVerifier = await deriveAuthVerifier(masterKeyBits);
    const dek = await generateDEK();
    const wrappedDek = await wrapDEK(encKeyBits, dek);
    const { mnemonic } = await generateMnemonicAsync();
    const recoveryKeyBits = await deriveRecoveryKey(mnemonic, user.id, recoverySaltBuf);
    const wrappedDekRecovery = await wrapDEK(recoveryKeyBits, dek);

    const doc: VaultDoc = {
      salt: saltB64,
      auth_verifier: authVerifier,
      wrapped_dek: wrappedDek,
      recovery_salt: recoverySaltB64,
      wrapped_dek_recovery: wrappedDekRecovery,
      created_at: new Date().toISOString(),
    };

    const token = await getAccessToken();
    await drive.writeFile(token, 'vault.json', doc);

    setDek(dek);
    bumpDek();
    setVaultDoc(doc);
    setStatus('unlocked');

    return mnemonic;
  }, [user, getAccessToken]);

  // ── unlockVault ────────────────────────────────────────────────────────────

  const unlockVault = useCallback(async (password: string): Promise<boolean> => {
    if (!vaultDoc || !user) return false;
    try {
      const saltBuf = base64ToBuffer(vaultDoc.salt);
      const masterKeyBits = await deriveMasterKey(password, user.id, saltBuf);
      const authVerifier = await deriveAuthVerifier(masterKeyBits);
      if (authVerifier !== vaultDoc.auth_verifier) return false;

      const encKeyBits = await deriveSubKey(masterKeyBits, 'encrypt');
      const dek = await unwrapDEK(encKeyBits, vaultDoc.wrapped_dek);
      setDek(dek);
      bumpDek();
      setStatus('unlocked');
      return true;
    } catch {
      return false;
    }
  }, [vaultDoc, user]);

  // ── lockVault ──────────────────────────────────────────────────────────────

  const lockVault = useCallback(() => {
    clearDek();
    bumpDek();
    setStatus(prev => (prev === 'unlocked' ? 'locked' : prev));
  }, []);

  // ── Auto-lock on background (screen off / app switch) ──────────────────────

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' && !autoLockPaused) lockVault();
    });
    return () => sub.remove();
  }, [lockVault, autoLockPaused]);

  // ── recoverVault ───────────────────────────────────────────────────────────

  const recoverVault = useCallback(async (
    mnemonic: string,
    newPassword: string,
  ): Promise<boolean> => {
    if (!vaultDoc || !user) return false;
    try {
      const normalised = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
      if (validateMnemonic(normalised)) return false;

      const recoverySaltBuf = base64ToBuffer(vaultDoc.recovery_salt);
      const recoveryKeyBits = await deriveRecoveryKey(normalised, user.id, recoverySaltBuf);
      const dek = await unwrapDEK(recoveryKeyBits, vaultDoc.wrapped_dek_recovery);

      // Re-encrypt DEK with the new password
      const newSaltB64 = generateSalt(32);
      const newSaltBuf = base64ToBuffer(newSaltB64);
      const newMasterKey = await deriveMasterKey(newPassword, user.id, newSaltBuf);
      const newEncKey = await deriveSubKey(newMasterKey, 'encrypt');
      const newAuthVerifier = await deriveAuthVerifier(newMasterKey);
      const newWrappedDek = await wrapDEK(newEncKey, dek);

      const updatedDoc: VaultDoc = {
        ...vaultDoc,
        salt: newSaltB64,
        auth_verifier: newAuthVerifier,
        wrapped_dek: newWrappedDek,
      };

      const token = await getAccessToken();
      await drive.writeFile(token, 'vault.json', updatedDoc);

      setDek(dek);
      bumpDek();
      setVaultDoc(updatedDoc);
      setStatus('unlocked');
      return true;
    } catch {
      return false;
    }
  }, [vaultDoc, user, getAccessToken]);

  // ── regenerateRecoveryKey (Phase 4 — Profile) ─────────────────────────────

  const regenerateRecoveryKey = useCallback(async (
    password: string,
  ): Promise<string | null> => {
    if (!vaultDoc || !user) return null;
    try {
      const saltBuf = base64ToBuffer(vaultDoc.salt);
      const masterKeyBits = await deriveMasterKey(password, user.id, saltBuf);
      const authVerifier = await deriveAuthVerifier(masterKeyBits);
      if (authVerifier !== vaultDoc.auth_verifier) return null;

      const encKeyBits = await deriveSubKey(masterKeyBits, 'encrypt');
      const dek = await unwrapDEK(encKeyBits, vaultDoc.wrapped_dek);

      const { mnemonic } = await generateMnemonicAsync();
      const newRecoverySaltB64 = generateSalt(32);
      const newRecoverySaltBuf = base64ToBuffer(newRecoverySaltB64);
      const newRecoveryKeyBits = await deriveRecoveryKey(mnemonic, user.id, newRecoverySaltBuf);
      const newWrappedDekRecovery = await wrapDEK(newRecoveryKeyBits, dek);

      const updatedDoc: VaultDoc = {
        ...vaultDoc,
        recovery_salt: newRecoverySaltB64,
        wrapped_dek_recovery: newWrappedDekRecovery,
      };

      const token = await getAccessToken();
      await drive.writeFile(token, 'vault.json', updatedDoc);
      setVaultDoc(updatedDoc);
      return mnemonic;
    } catch {
      return null;
    }
  }, [vaultDoc, user, getAccessToken]);

  const deleteVaultAndDriveData = useCallback(async (): Promise<void> => {
    if (!user) throw new Error('Not authenticated');

    const token = await getAccessToken();
    await drive.deleteAllAppDataFiles(token);

    clearDek();
    bumpDek();
    setVaultDoc(null);
    setStatus('setup_needed');
  }, [user, getAccessToken]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <VaultContext.Provider value={{
      status,
      vaultDoc,
      dekVersion,
      setupVault,
      unlockVault,
      lockVault,
      recoverVault,
      regenerateRecoveryKey,
      deleteVaultAndDriveData,
      setAutoLockPaused,
    }}>
      {children}
    </VaultContext.Provider>
  );
}
