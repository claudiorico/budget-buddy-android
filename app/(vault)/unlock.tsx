import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Keyboard, Platform, Alert, AppState,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { validateMnemonic } from '@/lib/crypto';
import { useBiometricVault, unlockWithBiometricDetailed } from '@/hooks/useBiometricVault';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;
const RESET_CONFIRMATION = 'APAGAR';

type Mode = 'unlock' | 'recover' | 'reset';

export default function VaultUnlockScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { unlockVault, recoverVault, deleteVaultAndDriveData } = useVault();

  const bio = useBiometricVault();
  const [mode, setMode] = useState<Mode>('unlock');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [error, setError] = useState('');
  const [appState, setAppState] = useState(AppState.currentState);
  const lastAutoBiometricAtRef = useRef(0);
  const autoBiometricTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockCompletedRef = useRef(false);
  const biometricInFlightRef = useRef(false);
  const autoBiometricAttemptedRef = useRef(false);

  const loading = passwordLoading || biometricLoading || resetLoading;

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  const [attempts, setAttempts] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBlocked = blockedUntil !== null && Date.now() < blockedUntil;

  useEffect(() => {
    if (!isBlocked) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setCountdown(0);
      return;
    }
    const update = () => {
      const remaining = Math.ceil(((blockedUntil ?? 0) - Date.now()) / 1000);
      if (remaining <= 0) {
        setBlockedUntil(null);
        setAttempts(0);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setCountdown(remaining);
      }
    };
    update();
    timerRef.current = setInterval(update, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [blockedUntil, isBlocked]);

  const recordFailedAttempt = () => {
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      setBlockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
    }
  };

  const offset = useSharedValue(0);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const shake = () => {
    offset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const handleBiometricUnlock = async ({ automatic = false } = {}) => {
    if (unlockCompletedRef.current) return;
    if (biometricInFlightRef.current) return;
    if (passwordLoading || biometricLoading || resetLoading || isBlocked) return;
    biometricInFlightRef.current = true;
    if (autoBiometricTimerRef.current) {
      clearTimeout(autoBiometricTimerRef.current);
      autoBiometricTimerRef.current = null;
    }
    setError('');
    setBiometricLoading(true);
    try {
      const result = await unlockWithBiometricDetailed();
      if (result.status !== 'success') {
        if (!automatic) {
          if (result.status === 'password_missing') {
            await bio.disable();
            setError('Digital reconhecida, mas a senha salva não foi encontrada. Desbloqueie com a senha e ative a digital novamente.');
          } else if (result.status === 'storage_error') {
            setError('Digital reconhecida, mas não consegui ler a senha salva. Use a senha e tente ativar a digital novamente.');
          } else {
            setError('Não foi possível usar digital. Use a senha ou tente novamente.');
          }
        }
        return;
      }
      const ok = await unlockVault(result.password);
      if (ok) {
        unlockCompletedRef.current = true;
        if (autoBiometricTimerRef.current) {
          clearTimeout(autoBiometricTimerRef.current);
          autoBiometricTimerRef.current = null;
        }
        router.replace('/(app)/dashboard');
      } else {
        await bio.disable();
        setError('Senha biométrica desatualizada. Use sua senha do cofre.');
      }
    } finally {
      biometricInFlightRef.current = false;
      setBiometricLoading(false);
    }
  };

  useEffect(() => {
    if (
      !bio.enabled ||
      unlockCompletedRef.current ||
      biometricInFlightRef.current ||
      autoBiometricAttemptedRef.current ||
      mode !== 'unlock' ||
      isBlocked ||
      appState !== 'active' ||
      passwordLoading ||
      biometricLoading ||
      resetLoading
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastAutoBiometricAtRef.current < 1500) return;

    if (autoBiometricTimerRef.current) {
      clearTimeout(autoBiometricTimerRef.current);
    }

    autoBiometricTimerRef.current = setTimeout(() => {
      if (autoBiometricAttemptedRef.current) return;
      autoBiometricAttemptedRef.current = true;
      lastAutoBiometricAtRef.current = Date.now();
      handleBiometricUnlock({ automatic: true });
    }, Platform.OS === 'android' ? 700 : 250);

    return () => {
      if (autoBiometricTimerRef.current) {
        clearTimeout(autoBiometricTimerRef.current);
        autoBiometricTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio.enabled, mode, isBlocked, appState, passwordLoading, biometricLoading, resetLoading]);

  const handleUnlock = async () => {
    if (isBlocked) return;
    setError('');
    setPasswordLoading(true);
    try {
      const ok = await unlockVault(password);
      if (ok) {
        router.replace('/(app)/dashboard');
      } else {
        recordFailedAttempt();
        shake();
        const remaining = MAX_ATTEMPTS - (attempts + 1);
        setError(
          remaining > 0
            ? `Senha incorreta — ${remaining} tentativa${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}`
            : 'Muitas tentativas. Aguarde 30 segundos.',
        );
        setPassword('');
      }
    } catch {
      setError('Erro ao desbloquear. Verifique sua conexão.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRecover = async () => {
    setError('');
    const normalised = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const mnemonicError = validateMnemonic(normalised);
    if (mnemonicError) { setError(mnemonicError); return; }
    if (newPassword.length < 8) { setError('A nova senha deve ter ao menos 8 caracteres'); return; }
    if (newPassword !== confirmNewPassword) { setError('As senhas não coincidem'); return; }

    setPasswordLoading(true);
    try {
      const ok = await recoverVault(normalised, newPassword);
      if (ok) {
        router.replace('/(app)/dashboard');
      } else {
        shake();
        setError('Palavras de recuperação inválidas. Verifique e tente novamente.');
      }
    } catch {
      setError('Erro ao recuperar o cofre. Verifique sua conexão.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setMnemonic('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetConfirmation('');
  };

  const openResetMode = () => {
    Alert.alert(
      'Perdeu senha e palavras?',
      'A única forma de continuar será apagar definitivamente o cofre e todos os dados do app no Google Drive. Isso não pode ser desfeito.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Entendo, continuar',
          style: 'destructive',
          onPress: () => switchMode('reset'),
        },
      ],
    );
  };

  const handleResetVault = () => {
    if (resetConfirmation.trim().toUpperCase() !== RESET_CONFIRMATION) {
      setError(`Digite ${RESET_CONFIRMATION} para confirmar.`);
      return;
    }

    Alert.alert(
      'Confirmar exclusão definitiva',
      'Vou apagar cofre, gastos, categorias e metas do Google Drive. Depois disso você criará um cofre novo vazio.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar tudo',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setResetLoading(true);
            try {
              await bio.disable();
              await deleteVaultAndDriveData();
              router.replace('/(vault)/setup');
            } catch {
              setError('Não foi possível apagar os dados. Verifique sua conexão e tente novamente.');
            } finally {
              setResetLoading(false);
            }
          },
        },
      ],
    );
  };

  const modeTitle = mode === 'unlock' ? 'Desbloquear Cofre' : mode === 'recover' ? 'Recuperar Cofre' : 'Criar cofre novo';
  const modeEmoji = mode === 'unlock' ? '🔒' : mode === 'recover' ? '🗝️' : '⚠️';
  const modeSubtitle = mode === 'unlock'
    ? 'Digite sua senha do cofre para acessar seus dados.'
    : mode === 'recover'
      ? 'Use suas 12 palavras para redefinir a senha.'
      : 'Use apenas se você perdeu senha e palavras. Seus dados atuais serão apagados.';

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-900"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: keyboardHeight > 0 ? keyboardHeight + 24 : 48,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View className="items-center mb-10">
        <Text className="text-5xl mb-4">{modeEmoji}</Text>
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {modeTitle}
        </Text>
        <Text className="text-sm text-gray-500 mt-1 text-center leading-relaxed">
          {modeSubtitle}
        </Text>
      </View>

      {isBlocked && (
        <View className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4 items-center">
          <Text className="text-red-700 dark:text-red-300 font-semibold text-sm">
            Muitas tentativas incorretas
          </Text>
          <Text className="text-red-600 dark:text-red-400 text-xs mt-1">
            Tente novamente em {countdown}s
          </Text>
        </View>
      )}

      {mode === 'unlock' && (
        <View className="gap-4">
          <Animated.View style={animStyle} className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Senha do cofre</Text>
            <View className="flex-row items-center border border-gray-300 dark:border-gray-600 rounded-xl px-4 bg-gray-50 dark:bg-gray-800">
              <TextInput
                testID="vault-password-input"
                className="flex-1 py-3.5 text-base text-gray-900 dark:text-gray-100"
                placeholder="Sua senha do cofre"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleUnlock}
                returnKeyType="done"
                editable={!isBlocked && !passwordLoading && !resetLoading}
                autoFocus
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                <Text className="text-gray-400 dark:text-gray-500 text-sm">{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <TouchableOpacity
            onPress={handleUnlock}
            disabled={passwordLoading || isBlocked || !password}
            activeOpacity={0.85}
            className={`rounded-xl py-4 items-center ${
              passwordLoading || isBlocked || !password ? 'bg-blue-300' : 'bg-blue-600'
            }`}
          >
            {passwordLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Desbloquear</Text>
            )}
          </TouchableOpacity>

          {bio.enabled && (
            <TouchableOpacity
              testID="bio-unlock-btn"
              onPress={() => handleBiometricUnlock()}
              disabled={passwordLoading || biometricLoading || resetLoading || isBlocked}
              className="flex-row items-center justify-center gap-2 border border-sky-500 dark:border-sky-400 rounded-xl py-3.5"
              activeOpacity={0.85}
            >
              <Ionicons name="finger-print" size={20} color="#0EA5E9" />
              {biometricLoading ? (
                <ActivityIndicator color="#0EA5E9" />
              ) : (
                <Text className="text-sky-600 dark:text-sky-400 font-semibold text-sm">
                  Usar digital
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => switchMode('recover')}
            className="items-center py-2"
          >
            <Text className="text-sm text-blue-600 dark:text-blue-400">
              Esqueceu a senha? Use a chave de recuperação
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openResetMode}
            className="items-center py-2"
          >
            <Text className="text-sm text-red-500 dark:text-red-400">
              Perdi senha e palavras
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={signOut}
            className="items-center py-2"
          >
            <Text className="text-sm text-gray-400 dark:text-gray-600">Sair da conta Google</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'recover' && (
        <View className="gap-4">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              12 palavras de recuperação
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 font-mono"
              placeholder="palavra1 palavra2 palavra3 ..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={mnemonic}
              onChangeText={setMnemonic}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ minHeight: 80 }}
            />
            <Text className="text-xs text-gray-400 dark:text-gray-600">
              Digite as 12 palavras separadas por espaço
            </Text>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Nova senha do cofre</Text>
            <View className="flex-row items-center border border-gray-300 dark:border-gray-600 rounded-xl px-4 bg-gray-50 dark:bg-gray-800">
              <TextInput
                className="flex-1 py-3.5 text-base text-gray-900 dark:text-gray-100"
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(v => !v)}>
                <Text className="text-gray-400 dark:text-gray-500 text-sm">{showNewPassword ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar nova senha</Text>
            <View className="flex-row items-center border border-gray-300 dark:border-gray-600 rounded-xl px-4 bg-gray-50 dark:bg-gray-800">
              <TextInput
                className="flex-1 py-3.5 text-base text-gray-900 dark:text-gray-100"
                placeholder="Repita a nova senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
              />
            </View>
          </View>

          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <TouchableOpacity
            onPress={handleRecover}
            disabled={passwordLoading}
            activeOpacity={0.85}
            className={`rounded-xl py-4 items-center ${passwordLoading ? 'bg-blue-300' : 'bg-blue-600'}`}
          >
            {passwordLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Recuperar cofre</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => switchMode('unlock')}
            className="items-center py-2"
          >
            <Text className="text-sm text-gray-500">← Voltar para senha</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'reset' && (
        <View className="gap-4">
          <View className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <Text className="text-red-700 dark:text-red-300 font-semibold text-sm">
              Exclusão definitiva
            </Text>
            <Text className="text-red-600 dark:text-red-400 text-xs mt-2 leading-relaxed">
              Isso apagará do Google Drive todos os arquivos do app: cofre, gastos,
              categorias e metas. Se não tiver backup externo, os dados atuais serão perdidos.
            </Text>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Digite {RESET_CONFIRMATION} para confirmar
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 font-semibold"
              placeholder={RESET_CONFIRMATION}
              placeholderTextColor="#9CA3AF"
              value={resetConfirmation}
              onChangeText={setResetConfirmation}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!resetLoading}
            />
          </View>

          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <TouchableOpacity
            onPress={handleResetVault}
            disabled={resetLoading || resetConfirmation.trim().toUpperCase() !== RESET_CONFIRMATION}
            activeOpacity={0.85}
            className={`rounded-xl py-4 items-center ${
              resetLoading || resetConfirmation.trim().toUpperCase() !== RESET_CONFIRMATION ? 'bg-red-300' : 'bg-red-600'
            }`}
          >
            {resetLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Apagar tudo e criar novo cofre</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => switchMode('unlock')}
            className="items-center py-2"
          >
            <Text className="text-sm text-gray-500">← Voltar para senha</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
