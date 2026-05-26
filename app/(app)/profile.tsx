import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  Animated, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Pressable, ActivityIndicator, Image,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useVault } from '@/contexts/VaultContext';
import { useGeminiKey } from '@/hooks/useGeminiKey';
import { parseExpenseFromText } from '@/lib/ai';

// ── Ko-fi ─────────────────────────────────────────────────────────────────────

const KOFI_URL = 'https://ko-fi.com/budgetbuddyapp';
const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey';

// ── Types ─────────────────────────────────────────────────────────────────────

type KeyRegenStep = 'password' | 'mnemonic';
type AiTestState = 'idle' | 'testing' | 'ok' | 'error';

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { lockVault, regenerateRecoveryKey } = useVault();
  const { apiKey, hasKey, setApiKey, clearKey } = useGeminiKey();

  // ── AI key modal ───────────────────────────────────────────────────────────
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [aiKeyVisible, setAiKeyVisible] = useState(false);
  const [aiTestState, setAiTestState] = useState<AiTestState>('idle');
  const [aiTestMessage, setAiTestMessage] = useState('');
  const aiSlideAnim = useRef(new Animated.Value(500)).current;

  // ── Key regen modal ────────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [regenStep, setRegenStep] = useState<KeyRegenStep>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newMnemonic, setNewMnemonic] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [copied, setCopied] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;

  const openModal = useCallback(() => {
    setRegenStep('password');
    setPassword('');
    setShowPassword(false);
    setRegenError('');
    setNewMnemonic('');
    setCopied(false);
    setModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [slideAnim]);

  const closeModal = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => setModalVisible(false));
  }, [slideAnim]);

  const handleRegenConfirm = useCallback(async () => {
    if (!password.trim()) {
      setRegenError('Digite sua senha.');
      return;
    }
    setRegenLoading(true);
    setRegenError('');
    try {
      const mnemonic = await regenerateRecoveryKey(password);
      if (!mnemonic) {
        setRegenError('Senha incorreta. Tente novamente.');
        return;
      }
      setNewMnemonic(mnemonic);
      setRegenStep('mnemonic');
    } finally {
      setRegenLoading(false);
    }
  }, [password, regenerateRecoveryKey]);

  const handleCopyMnemonic = useCallback(async () => {
    await Clipboard.setStringAsync(newMnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, [newMnemonic]);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sair da conta',
      'Isso irá desconectar sua conta Google e bloquear o cofre. Seus dados permanecem no Google Drive.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            lockVault();
            signOut();
          },
        },
      ],
    );
  }, [lockVault, signOut]);

  // ── Lock vault ─────────────────────────────────────────────────────────────
  const handleLock = useCallback(() => {
    lockVault();
  }, [lockVault]);

  // ── Ko-fi ──────────────────────────────────────────────────────────────────
  const handleKofi = useCallback(() => {
    Linking.openURL(KOFI_URL);
  }, []);

  // ── AI key modal ───────────────────────────────────────────────────────────
  const openAiModal = useCallback(() => {
    setAiKeyInput(apiKey ?? '');
    setAiKeyVisible(false);
    setAiTestState('idle');
    setAiTestMessage('');
    setAiModalVisible(true);
    Animated.spring(aiSlideAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [apiKey, aiSlideAnim]);

  const closeAiModal = useCallback(() => {
    Animated.timing(aiSlideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => setAiModalVisible(false));
  }, [aiSlideAnim]);

  const handleAiSave = useCallback(() => {
    setApiKey(aiKeyInput);
    closeAiModal();
  }, [aiKeyInput, setApiKey, closeAiModal]);

  const handleAiClear = useCallback(() => {
    Alert.alert(
      'Remover chave?',
      'Você não poderá usar texto/voz até configurar uma nova chave.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => {
          clearKey();
          closeAiModal();
        }},
      ],
    );
  }, [clearKey, closeAiModal]);

  const handleAiTest = useCallback(async () => {
    if (!aiKeyInput.trim()) {
      setAiTestState('error');
      setAiTestMessage('Cole a chave primeiro.');
      return;
    }
    setApiKey(aiKeyInput);
    setAiTestState('testing');
    setAiTestMessage('');
    try {
      const draft = await parseExpenseFromText('teste 10 reais hoje', []);
      if (draft.value_brl > 0) {
        setAiTestState('ok');
        setAiTestMessage(`OK! Extraiu valor R$ ${draft.value_brl.toFixed(2)}`);
      } else {
        setAiTestState('error');
        setAiTestMessage('Chave aceita mas resposta inesperada.');
      }
    } catch (e) {
      setAiTestState('error');
      setAiTestMessage((e as Error).message || 'Falha ao chamar Gemini.');
    }
  }, [aiKeyInput, setApiKey]);

  const handleOpenKeyDocs = useCallback(() => {
    Linking.openURL(GEMINI_KEY_URL);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Header */}
        <View className="px-4 pt-3 pb-4">
          <Text className="text-xl font-bold text-gray-900">Perfil</Text>
        </View>

        {/* ── User card ──────────────────────────────────────────────────── */}
        <View className="mx-4 mb-4 bg-white rounded-2xl p-5 shadow-sm flex-row items-center gap-4">
          {user?.photo ? (
            <Image
              source={{ uri: user.photo }}
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center">
              <Ionicons name="person" size={32} color="#2563EB" />
            </View>
          )}
          <View className="flex-1 min-w-0">
            <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
              {user?.name ?? 'Usuário'}
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-2">
              <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <Text className="text-xs text-green-600 font-medium">Cofre desbloqueado</Text>
            </View>
          </View>
        </View>

        {/* ── Security section ───────────────────────────────────────────── */}
        <View className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Segurança
            </Text>
          </View>

          {/* Lock vault */}
          <ActionRow
            icon="lock-closed-outline"
            iconColor="#F59E0B"
            label="Bloquear cofre"
            subtitle="Limpa a chave da memória"
            onPress={handleLock}
          />

          <View className="mx-4 h-px bg-gray-100" />

          {/* Regen recovery key */}
          <ActionRow
            icon="key-outline"
            iconColor="#6366F1"
            label="Regenerar chave de recuperação"
            subtitle="Cria uma nova frase de 12 palavras"
            onPress={openModal}
          />
        </View>

        {/* ── Account section ────────────────────────────────────────────── */}
        <View className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Conta
            </Text>
          </View>

          <ActionRow
            icon="log-out-outline"
            iconColor="#EF4444"
            label="Sair da conta"
            subtitle="Desconectar Google e bloquear cofre"
            onPress={handleSignOut}
            destructive
          />
        </View>

        {/* ── AI section ─────────────────────────────────────────────────── */}
        <View className="mx-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden">
          <View className="px-4 pt-4 pb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              IA
            </Text>
          </View>
          <ActionRow
            icon="sparkles-outline"
            iconColor="#7C3AED"
            label="Configurar API Gemini"
            subtitle={hasKey ? 'Configurada — toque para alterar' : 'Não configurada'}
            onPress={openAiModal}
          />
        </View>

        {/* ── About section ──────────────────────────────────────────────── */}
        <View className="mx-4 mb-4 bg-white rounded-2xl p-4 shadow-sm">
          <View className="px-0 pb-2">
            <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Sobre
            </Text>
          </View>
          <View className="gap-1 mt-1">
            <Row label="Versão" value="1.0.0" />
            <Row label="Armazenamento" value="Google Drive (appdata)" />
            <Row label="Criptografia" value="AES-256-GCM + PBKDF2" />
          </View>
        </View>

        {/* ── Ko-fi card ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleKofi}
          activeOpacity={0.85}
          className="mx-4 mb-2"
        >
          <View
            className="rounded-2xl p-5 flex-row items-center gap-4"
            style={{ backgroundColor: '#FF5E5B' }}
          >
            <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
              <Text className="text-2xl">☕</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">Apoiar no Ko-fi</Text>
              <Text className="text-white/80 text-xs mt-0.5">
                Se o app te ajuda, considere contribuir!
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>

        <Text className="text-center text-xs text-gray-300 mt-4 px-8">
          Budget Buddy · Seus dados ficam apenas no seu Google Drive.{'\n'}
          Nenhum servidor. Zero custódia.
        </Text>
      </ScrollView>

      {/* ── AI Key Modal ────────────────────────────────────────────────────── */}
      <Modal
        visible={aiModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeAiModal}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            onPress={closeAiModal}
          />
          <Animated.View
            style={{
              transform: [{ translateY: aiSlideAnim }],
              backgroundColor: 'white',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="items-center pt-3 pb-1">
                <View className="w-10 h-1 bg-gray-200 rounded-full" />
              </View>
              <View
                className="px-5"
                style={{ paddingBottom: Math.max(insets.bottom + 8, 24) }}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-base font-semibold text-gray-900">
                    Configurar API Gemini
                  </Text>
                  <TouchableOpacity onPress={closeAiModal}>
                    <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <Text className="text-xs text-gray-500 mb-3">
                  Sua chave fica apenas neste device. Free tier do Google cobre uso pessoal.
                </Text>

                <TouchableOpacity
                  onPress={handleOpenKeyDocs}
                  className="flex-row items-center gap-1.5 mb-3"
                >
                  <Ionicons name="open-outline" size={14} color="#2563EB" />
                  <Text className="text-xs text-blue-600 font-medium">
                    Obter chave grátis no Google AI Studio
                  </Text>
                </TouchableOpacity>

                <Text className="text-xs font-medium text-gray-500 mb-1.5">
                  API key
                </Text>
                <View className="bg-gray-100 rounded-xl flex-row items-center px-4 mb-3">
                  <TextInput
                    className="flex-1 py-3 text-sm text-gray-800"
                    value={aiKeyInput}
                    onChangeText={text => {
                      setAiKeyInput(text);
                      setAiTestState('idle');
                    }}
                    secureTextEntry={!aiKeyVisible}
                    placeholder="AIza..."
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setAiKeyVisible(v => !v)}>
                    <Ionicons
                      name={aiKeyVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>

                {aiTestState !== 'idle' && (
                  <View className={`rounded-xl px-3 py-2.5 mb-3 flex-row items-center gap-2 ${
                    aiTestState === 'ok' ? 'bg-green-50 border border-green-200'
                      : aiTestState === 'error' ? 'bg-red-50 border border-red-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}>
                    {aiTestState === 'testing' && <ActivityIndicator size="small" color="#6B7280" />}
                    {aiTestState === 'ok' && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
                    {aiTestState === 'error' && <Ionicons name="close-circle" size={16} color="#EF4444" />}
                    <Text className={`text-xs flex-1 ${
                      aiTestState === 'ok' ? 'text-green-700'
                        : aiTestState === 'error' ? 'text-red-700'
                        : 'text-gray-600'
                    }`}>
                      {aiTestState === 'testing' ? 'Testando…' : aiTestMessage}
                    </Text>
                  </View>
                )}

                <View className="flex-row gap-2 mb-2">
                  <TouchableOpacity
                    onPress={handleAiTest}
                    disabled={aiTestState === 'testing'}
                    className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                    activeOpacity={0.85}
                  >
                    <Text className="text-gray-700 font-semibold text-sm">Testar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAiSave}
                    disabled={!aiKeyInput.trim()}
                    className={`flex-1 rounded-xl py-3 items-center ${
                      aiKeyInput.trim() ? 'bg-blue-600' : 'bg-blue-300'
                    }`}
                    activeOpacity={0.85}
                  >
                    <Text className="text-white font-semibold text-sm">Salvar</Text>
                  </TouchableOpacity>
                </View>

                {hasKey && (
                  <TouchableOpacity
                    onPress={handleAiClear}
                    className="py-2 items-center"
                  >
                    <Text className="text-xs text-red-500 font-medium">Remover chave</Text>
                  </TouchableOpacity>
                )}
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Key Regeneration Modal ──────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            onPress={regenStep === 'password' ? closeModal : undefined}
          />
          <Animated.View
            style={{
              transform: [{ translateY: slideAnim }],
              backgroundColor: 'white',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {/* Handle */}
              <View className="items-center pt-3 pb-1">
                <View className="w-10 h-1 bg-gray-200 rounded-full" />
              </View>

              <View
                className="px-5"
                style={{ paddingBottom: Math.max(insets.bottom + 8, 24) }}
              >
                {/* ── Step 1: Password ────────────────────────────────────── */}
                {regenStep === 'password' && (
                  <>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-base font-semibold text-gray-900">
                        Regenerar chave de recuperação
                      </Text>
                      <TouchableOpacity onPress={closeModal}>
                        <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-xs text-gray-500 mb-4">
                      Confirme sua senha para criar uma nova frase de 12 palavras.
                      A frase anterior será invalidada.
                    </Text>

                    <Text className="text-xs font-medium text-gray-500 mb-1.5">
                      Senha atual
                    </Text>
                    <View className="bg-gray-100 rounded-xl flex-row items-center px-4 mb-1">
                      <TextInput
                        className="flex-1 py-3 text-sm text-gray-800"
                        value={password}
                        onChangeText={text => {
                          setPassword(text);
                          setRegenError('');
                        }}
                        secureTextEntry={!showPassword}
                        placeholder="Digite sua senha"
                        placeholderTextColor="#9CA3AF"
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleRegenConfirm}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </View>

                    {regenError ? (
                      <Text className="text-xs text-red-500 mb-3">{regenError}</Text>
                    ) : (
                      <View className="mb-3" />
                    )}

                    <TouchableOpacity
                      onPress={handleRegenConfirm}
                      disabled={regenLoading}
                      className="bg-indigo-600 rounded-xl py-3.5 items-center"
                      activeOpacity={0.85}
                    >
                      {regenLoading
                        ? <ActivityIndicator color="white" />
                        : <Text className="text-white font-semibold text-sm">Confirmar</Text>
                      }
                    </TouchableOpacity>
                  </>
                )}

                {/* ── Step 2: New mnemonic ─────────────────────────────────── */}
                {regenStep === 'mnemonic' && (
                  <>
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className="w-6 h-6 rounded-full bg-green-100 items-center justify-center">
                        <Ionicons name="checkmark" size={14} color="#10B981" />
                      </View>
                      <Text className="text-base font-semibold text-gray-900">
                        Nova chave gerada!
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-500 mb-4">
                      Anote as 12 palavras abaixo em local seguro. Essa frase é a
                      única forma de recuperar sua conta se esquecer a senha.
                    </Text>

                    {/* Mnemonic grid */}
                    <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                      <View className="flex-row flex-wrap gap-2">
                        {newMnemonic.split(' ').map((word, i) => (
                          <View
                            key={i}
                            className="flex-row items-center gap-1 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5"
                          >
                            <Text className="text-xs text-amber-400 font-medium w-4 text-right">
                              {i + 1}.
                            </Text>
                            <Text className="text-xs font-mono font-semibold text-gray-800">
                              {word}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Copy button */}
                    <TouchableOpacity
                      onPress={handleCopyMnemonic}
                      className={`flex-row items-center justify-center gap-2 rounded-xl py-3 mb-3 ${
                        copied ? 'bg-green-100' : 'bg-gray-100'
                      }`}
                    >
                      <Ionicons
                        name={copied ? 'checkmark-circle' : 'copy-outline'}
                        size={16}
                        color={copied ? '#10B981' : '#6B7280'}
                      />
                      <Text
                        className={`text-sm font-medium ${
                          copied ? 'text-green-700' : 'text-gray-600'
                        }`}
                      >
                        {copied ? 'Copiado!' : 'Copiar frase'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={closeModal}
                      className="bg-blue-600 rounded-xl py-3.5 items-center"
                      activeOpacity={0.85}
                    >
                      <Text className="text-white font-semibold text-sm">Concluído</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionRow({
  icon, iconColor, label, subtitle, onPress, destructive,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="px-4 py-3.5 flex-row items-center gap-3"
      activeOpacity={0.7}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{ backgroundColor: iconColor + '18' }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${
            destructive ? 'text-red-600' : 'text-gray-800'
          }`}
        >
          {label}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-xs text-gray-500">{label}</Text>
      <Text className="text-xs font-medium text-gray-700">{value}</Text>
    </View>
  );
}
