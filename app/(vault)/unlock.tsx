import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
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
import { useBiometricVault, unlockWithBiometric } from '@/hooks/useBiometricVault';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

type Mode = 'unlock' | 'recover';

export default function VaultUnlockScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { unlockVault, recoverVault } = useVault();

  const bio = useBiometricVault();
  const [mode, setMode] = useState<Mode>('unlock');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Lockout ───────────────────────────────────────────────────────────────

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
  }, [blockedUntil]);

  const recordFailedAttempt = () => {
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      setBlockedUntil(Date.now() + LOCKOUT_SECONDS * 1000);
    }
  };

  // ── Shake animation ───────────────────────────────────────────────────────

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

  // ── Biometric unlock ─────────────────────────────────────────────────────

  const handleBiometricUnlock = async () => {
    if (loading || isBlocked) return;
    setError('');
    setLoading(true);
    try {
      const pwd = await unlockWithBiometric();
      if (!pwd) {
        // Cancelado ou falhou — silencioso, usuário pode tentar de novo ou usar senha
        return;
      }
      const ok = await unlockVault(pwd);
      if (ok) {
        router.replace('/(app)/dashboard');
      } else {
        // Senha guardada não bate mais — provavelmente trocou via recover
        setError('Senha biométrica desatualizada. Use sua senha do cofre.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-tentar biometria ao abrir a tela, se ativado
  useEffect(() => {
    if (bio.enabled && mode === 'unlock' && !isBlocked) {
      handleBiometricUnlock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio.enabled]);

  // ── Unlock ────────────────────────────────────────────────────────────────

  const handleUnlock = async () => {
    if (isBlocked) return;
    setError('');
    setLoading(true);
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
      setLoading(false);
    }
  };

  // ── Recover ───────────────────────────────────────────────────────────────

  const handleRecover = async () => {
    setError('');
    const normalised = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    const mnemonicError = validateMnemonic(normalised);
    if (mnemonicError) { setError(mnemonicError); return; }
    if (newPassword.length < 8) { setError('A nova senha deve ter ao menos 8 caracteres'); return; }
    if (newPassword !== confirmNewPassword) { setError('As senhas não coincidem'); return; }

    setLoading(true);
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
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setPassword('');
    setMnemonic('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-900"
      contentContainerClassName="flex-grow justify-center px-6 py-12"
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View className="items-center mb-10">
        <Text className="text-5xl mb-4">{mode === 'unlock' ? '🔒' : '🗝️'}</Text>
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {mode === 'unlock' ? 'Desbloquear Cofre' : 'Recuperar Cofre'}
        </Text>
        <Text className="text-sm text-gray-500 mt-1 text-center leading-relaxed">
          {mode === 'unlock'
            ? 'Digite sua senha do cofre para acessar seus dados.'
            : 'Use suas 12 palavras para redefinir a senha.'}
        </Text>
      </View>

      {/* ── Lockout banner ───────────────────────────────────────────────── */}

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

      {/* ── Unlock mode ──────────────────────────────────────────────────── */}

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
                editable={!isBlocked && !loading}
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
            disabled={loading || isBlocked || !password}
            activeOpacity={0.85}
            className={`rounded-xl py-4 items-center ${
              loading || isBlocked || !password ? 'bg-blue-300' : 'bg-blue-600'
            }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Desbloquear</Text>
            )}
          </TouchableOpacity>

          {bio.enabled && (
            <TouchableOpacity
              testID="bio-unlock-btn"
              onPress={handleBiometricUnlock}
              disabled={loading || isBlocked}
              className="flex-row items-center justify-center gap-2 border border-sky-500 dark:border-sky-400 rounded-xl py-3.5"
              activeOpacity={0.85}
            >
              <Ionicons name="finger-print" size={20} color="#0EA5E9" />
              <Text className="text-sky-600 dark:text-sky-400 font-semibold text-sm">
                Usar digital
              </Text>
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
            onPress={signOut}
            className="items-center py-2"
          >
            <Text className="text-sm text-gray-400 dark:text-gray-600">Sair da conta Google</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recover mode ─────────────────────────────────────────────────── */}

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
            disabled={loading}
            activeOpacity={0.85}
            className={`rounded-xl py-4 items-center ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}
          >
            {loading ? (
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
    </ScrollView>
  );
}
