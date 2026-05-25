import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useVault } from '@/contexts/VaultContext';
import { MnemonicGrid } from '@/components/MnemonicGrid';

const STEP = { PASSWORD: 1, MNEMONIC: 2, CONFIRM: 3 } as const;
type Step = typeof STEP[keyof typeof STEP];

export default function VaultSetupScreen() {
  const router = useRouter();
  const { setupVault } = useVault();

  const [step, setStep] = useState<Step>(STEP.PASSWORD);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const words = mnemonic ? mnemonic.split(' ') : [];

  // ── Step 1: set password ──────────────────────────────────────────────────

  const handleSetPassword = async () => {
    setError('');
    if (password.length < 8) {
      setError('A senha deve ter ao menos 8 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    setLoading(true);
    try {
      const generatedMnemonic = await setupVault(password);
      setMnemonic(generatedMnemonic);
      setStep(STEP.MNEMONIC);
    } catch {
      setError('Erro ao configurar o cofre. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: copy mnemonic ─────────────────────────────────────────────────

  const handleCopy = async () => {
    await Clipboard.setStringAsync(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Step 3: confirm ───────────────────────────────────────────────────────

  const handleConfirm = () => {
    router.replace('/(app)/dashboard');
  };

  // ── Progress dots ─────────────────────────────────────────────────────────

  const ProgressDots = () => (
    <View className="flex-row gap-2 justify-center mb-8">
      {[1, 2, 3].map(n => (
        <View
          key={n}
          className={`h-2 w-8 rounded-full ${step >= n ? 'bg-blue-600' : 'bg-gray-200'}`}
        />
      ))}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow justify-center px-6 py-12"
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View className="items-center mb-8">
        <Text className="text-4xl mb-3">🛡️</Text>
        <Text className="text-2xl font-bold text-gray-900">Configurar Cofre</Text>
        <Text className="text-sm text-gray-500 mt-1 text-center leading-relaxed">
          Seus dados serão criptografados localmente{'\n'}antes de ir para o Drive.
        </Text>
      </View>

      <ProgressDots />

      {/* ── Step 1: Password ─────────────────────────────────────────────── */}

      {step === STEP.PASSWORD && (
        <View className="gap-4">
          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700">Senha do cofre</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50">
              <TextInput
                className="flex-1 py-3.5 text-base text-gray-900"
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoFocus
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                <Text className="text-gray-400 text-sm">{showPassword ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-gray-700">Confirmar senha</Text>
            <View className="flex-row items-center border border-gray-300 rounded-xl px-4 bg-gray-50">
              <TextInput
                className="flex-1 py-3.5 text-base text-gray-900"
                placeholder="Repita a senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                <Text className="text-gray-400 text-sm">{showConfirm ? 'Ocultar' : 'Ver'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}

          <Text className="text-xs text-gray-400 leading-relaxed">
            Esta senha é diferente da sua conta Google. Ela protege seus dados financeiros
            e não pode ser recuperada por ninguém além de você.
          </Text>

          <TouchableOpacity
            onPress={handleSetPassword}
            disabled={loading}
            activeOpacity={0.85}
            className={`rounded-xl py-4 items-center ${loading ? 'bg-blue-300' : 'bg-blue-600'}`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-base">Continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 2: Mnemonic ─────────────────────────────────────────────── */}

      {step === STEP.MNEMONIC && (
        <View className="gap-4">
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 gap-3">
            <Text className="text-sm font-semibold text-amber-800">
              ⚠️  Chave de recuperação — guarde em local seguro
            </Text>
            <Text className="text-xs text-amber-700 leading-relaxed">
              Se esquecer sua senha, estas 12 palavras são a única forma de recuperar
              seus dados. Ninguém mais tem acesso a elas.
            </Text>
            <MnemonicGrid words={words} />
          </View>

          <TouchableOpacity
            onPress={handleCopy}
            activeOpacity={0.8}
            className="border border-gray-300 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
          >
            <Text className="text-base">{copied ? '✅' : '📋'}</Text>
            <Text className="text-gray-700 font-medium">
              {copied ? 'Copiado!' : 'Copiar palavras'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStep(STEP.CONFIRM)}
            activeOpacity={0.85}
            className="bg-blue-600 rounded-xl py-4 items-center"
          >
            <Text className="text-white font-semibold text-base">
              Guardei a chave de recuperação
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Step 3: Confirm ──────────────────────────────────────────────── */}

      {step === STEP.CONFIRM && (
        <View className="gap-4">
          <TouchableOpacity
            onPress={() => setConfirmed(v => !v)}
            activeOpacity={0.8}
            className="border border-gray-200 rounded-2xl p-4 flex-row items-start gap-3 bg-gray-50"
          >
            <View
              className={`w-5 h-5 rounded border-2 mt-0.5 items-center justify-center flex-shrink-0 ${
                confirmed ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
              }`}
            >
              {confirmed && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-sm text-gray-700 flex-1 leading-relaxed">
              Confirmo que salvei as 12 palavras em local seguro e entendo que sem elas
              não será possível recuperar meus dados caso esqueça a senha do cofre.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!confirmed}
            activeOpacity={0.85}
            className={`rounded-xl py-4 flex-row items-center justify-center gap-2 ${
              confirmed ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <Text className="text-2xl">🔐</Text>
            <Text
              className={`font-semibold text-base ${confirmed ? 'text-white' : 'text-gray-400'}`}
            >
              Entrar no app
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
