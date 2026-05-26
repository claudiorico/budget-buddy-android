import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  Animated, ScrollView, Pressable, ActivityIndicator, Keyboard, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { parseExpenseFromText, MissingApiKeyError, type ExpenseDraft } from '@/lib/ai';
import { useGeminiKey } from '@/hooks/useGeminiKey';
import type { Category } from '@/contexts/DataContext';

type InputStage = 'choose' | 'voice' | 'text';

type Props = {
  visible: boolean;
  categories: Category[];
  initialText?: string;
  onCancel: () => void;
  onManual: () => void;
  onParsed: (draft: ExpenseDraft) => void;
};

export function ExpenseInputSheet({
  visible, categories, initialText, onCancel, onManual, onParsed,
}: Props) {
  const insets = useSafeAreaInsets();
  const { hasKey } = useGeminiKey();

  const [stage, setStage] = useState<InputStage>('choose');
  const [text, setText] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [recording, setRecording] = useState(false);
  const [parsing, setParsing] = useState(false);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const kbOffset = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(Animated.subtract(slideAnim, kbOffset)).current;

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    setVoiceText(transcript);
  });
  useSpeechRecognitionEvent('end', () => setRecording(false));
  useSpeechRecognitionEvent('error', (event) => {
    setRecording(false);
    if (event.error !== 'no-speech') {
      Alert.alert('Erro no reconhecimento', event.message || event.error);
    }
  });

  useEffect(() => {
    if (visible) {
      if (initialText) {
        setStage('text');
        setText(initialText);
      } else {
        setStage('choose');
        setText('');
      }
      setVoiceText('');
      kbOffset.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    } else {
      slideAnim.setValue(500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialText]);

  useEffect(() => {
    if (!visible) {
      kbOffset.setValue(0);
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(kbOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 180,
        useNativeDriver: true,
      }).start();
    });
    const onHide = Keyboard.addListener(hideEvt, () => {
      Animated.timing(kbOffset, {
        toValue: 0, duration: 180, useNativeDriver: true,
      }).start();
    });
    return () => { onShow.remove(); onHide.remove(); };
  }, [visible, kbOffset]);

  const animateClose = useCallback((after: () => void) => {
    Keyboard.dismiss();
    if (recording) ExpoSpeechRecognitionModule.stop();
    kbOffset.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => after());
  }, [slideAnim, kbOffset, recording]);

  const handleClose = useCallback(() => animateClose(onCancel), [animateClose, onCancel]);
  const handleManual = useCallback(() => animateClose(onManual), [animateClose, onManual]);

  const handleParse = useCallback(async (rawText: string) => {
    if (!rawText.trim()) {
      Alert.alert('Texto vazio', 'Descreva o gasto antes de continuar.');
      return;
    }
    if (!hasKey) {
      Alert.alert(
        'Configure a IA',
        'Adicione sua API key do Gemini em Perfil → Configurar IA para usar texto/voz.',
      );
      return;
    }
    setParsing(true);
    try {
      const hints = categories.map(c => ({ category_id: c.category_id, name: c.name }));
      const draft = await parseExpenseFromText(rawText, hints);
      animateClose(() => onParsed(draft));
    } catch (e) {
      if (e instanceof MissingApiKeyError) {
        Alert.alert('Sem chave', 'Configure a API do Gemini no Perfil.');
      } else {
        Alert.alert('Erro da IA', (e as Error).message || 'Tente novamente.');
      }
    } finally {
      setParsing(false);
    }
  }, [hasKey, categories, animateClose, onParsed]);

  const startVoice = useCallback(async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Permita o microfone para ditar gastos.');
        return;
      }
      setVoiceText('');
      setRecording(true);
      ExpoSpeechRecognitionModule.start({
        lang: 'pt-BR',
        interimResults: true,
        continuous: false,
      });
    } catch (e) {
      setRecording(false);
      Alert.alert('Erro', (e as Error).message);
    }
  }, []);

  const stopVoice = useCallback(() => {
    if (recording) ExpoSpeechRecognitionModule.stop();
  }, [recording]);

  const confirmVoice = useCallback(() => {
    handleParse(voiceText);
  }, [voiceText, handleParse]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onPress={handleClose}
        />

        <Animated.View
          style={{
            transform: [{ translateY: sheetTranslateY }],
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 bg-gray-200 rounded-full" />
          </View>

          <View className="flex-row items-center justify-between px-5 mb-2">
            <View className="flex-row items-center gap-2">
              {stage !== 'choose' && (
                <TouchableOpacity onPress={() => setStage('choose')} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color="#6B7280" />
                </TouchableOpacity>
              )}
              <Text className="text-base font-semibold text-gray-900">
                {stage === 'choose' && 'Adicionar gasto'}
                {stage === 'voice' && 'Ditar gasto'}
                {stage === 'text' && 'Descrever em texto'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close-circle" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: Math.max(insets.bottom + 16, 28),
            }}
          >
            {stage === 'choose' && (
              <View className="gap-3 mt-2">
                {!hasKey && (
                  <View className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex-row items-center gap-2 mb-1">
                    <Ionicons name="information-circle-outline" size={16} color="#D97706" />
                    <Text className="text-xs text-amber-700 flex-1">
                      Configure a IA no Perfil para usar texto/voz.
                    </Text>
                  </View>
                )}

                <ChoiceButton
                  icon="mic-outline"
                  iconColor="#7C3AED"
                  label="Ditar por voz"
                  subtitle="Fale o gasto e a IA preenche"
                  onPress={() => setStage('voice')}
                  disabled={!hasKey}
                />
                <ChoiceButton
                  icon="chatbubble-outline"
                  iconColor="#2563EB"
                  label="Descrever em texto"
                  subtitle='"Almoço hoje 45,90" → IA extrai os campos'
                  onPress={() => setStage('text')}
                  disabled={!hasKey}
                />
                <ChoiceButton
                  icon="create-outline"
                  iconColor="#6B7280"
                  label="Preencher manual"
                  subtitle="Form tradicional, sempre disponível"
                  onPress={handleManual}
                />
              </View>
            )}

            {stage === 'text' && (
              <View className="mt-2">
                <Text className="text-xs font-medium text-gray-500 mb-1.5">
                  Conte o que aconteceu
                </Text>
                <TextInput
                  className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 mb-3"
                  value={text}
                  onChangeText={setText}
                  placeholder="Ex: Uber pro centro ontem 28,50"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  autoFocus
                  textAlignVertical="top"
                  style={{ minHeight: 80 }}
                />
                <TouchableOpacity
                  onPress={() => handleParse(text)}
                  disabled={parsing || !text.trim()}
                  className={`rounded-xl py-3.5 items-center ${
                    parsing || !text.trim() ? 'bg-blue-300' : 'bg-blue-600'
                  }`}
                  activeOpacity={0.85}
                >
                  {parsing
                    ? <ActivityIndicator color="white" />
                    : <Text className="text-white font-semibold text-sm">Extrair com IA</Text>}
                </TouchableOpacity>
              </View>
            )}

            {stage === 'voice' && (
              <View className="mt-2 items-center pb-4">
                <Text className="text-xs text-gray-500 mb-4 text-center px-4">
                  Toque no botão e fale o gasto. Ex: "café 8 reais" ou "uber 25,90 ontem".
                </Text>

                <TouchableOpacity
                  onPress={recording ? stopVoice : startVoice}
                  disabled={parsing}
                  activeOpacity={0.85}
                  className={`w-24 h-24 rounded-full items-center justify-center ${
                    recording ? 'bg-red-500' : 'bg-purple-600'
                  }`}
                >
                  <Ionicons
                    name={recording ? 'stop' : 'mic'}
                    size={42}
                    color="white"
                  />
                </TouchableOpacity>

                <Text className="text-xs text-gray-400 mt-3">
                  {recording ? 'Ouvindo… toque para parar' : 'Toque para falar'}
                </Text>

                {voiceText ? (
                  <View className="w-full bg-gray-50 rounded-xl px-4 py-3 mt-5 mb-3">
                    <Text className="text-xs text-gray-400 mb-1">Transcrição</Text>
                    <Text className="text-sm text-gray-800">{voiceText}</Text>
                  </View>
                ) : null}

                {voiceText && !recording && (
                  <TouchableOpacity
                    onPress={confirmVoice}
                    disabled={parsing}
                    className={`w-full rounded-xl py-3.5 items-center ${
                      parsing ? 'bg-blue-300' : 'bg-blue-600'
                    }`}
                    activeOpacity={0.85}
                  >
                    {parsing
                      ? <ActivityIndicator color="white" />
                      : <Text className="text-white font-semibold text-sm">Extrair com IA</Text>}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ChoiceButton({
  icon, iconColor, label, subtitle, onPress, disabled,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${
        disabled ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-gray-200'
      }`}
    >
      <View
        className="w-11 h-11 rounded-xl items-center justify-center"
        style={{ backgroundColor: iconColor + '18' }}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-800">{label}</Text>
        <Text className="text-xs text-gray-400 mt-0.5">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
    </TouchableOpacity>
  );
}
