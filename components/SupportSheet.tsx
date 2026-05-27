import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  Animated, Pressable, Keyboard, Platform, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { SUPPORT_EMAIL, APP_NAME } from '@/lib/contact';

type Subject = 'erro' | 'sugestao' | 'elogio';

const SUBJECTS: { id: Subject; label: string; icon: string; color: string }[] = [
  { id: 'erro',     label: 'Erro',     icon: '🐞', color: '#EF4444' },
  { id: 'sugestao', label: 'Sugestão', icon: '💡', color: '#F59E0B' },
  { id: 'elogio',   label: 'Elogio',   icon: '❤️', color: '#10B981' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SupportSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetBg = isDark ? '#111827' : 'white';

  const [subject, setSubject] = useState<Subject | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const kbOffset = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(Animated.subtract(slideAnim, kbOffset)).current;

  useEffect(() => {
    if (visible) {
      setSubject(null);
      setMessage('');
      kbOffset.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    } else {
      slideAnim.setValue(500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
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

  const animateClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => onClose());
  }, [slideAnim, onClose]);

  const handleSend = useCallback(async () => {
    if (!subject) {
      Alert.alert('Assunto obrigatório', 'Escolha um tipo de mensagem.');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Mensagem obrigatória', 'Descreva o problema ou sugestão.');
      return;
    }
    setSending(true);
    try {
      const subjectMeta = SUBJECTS.find(s => s.id === subject)!;
      const appVersion = Constants.expoConfig?.version ?? 'dev';
      const platform = `${Platform.OS} ${Platform.Version}`;
      const body =
        `${message.trim()}\n\n` +
        `---\n` +
        `App: ${APP_NAME} v${appVersion}\n` +
        `Plataforma: ${platform}`;

      const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        `[${APP_NAME}] ${subjectMeta.label}`,
      )}&body=${encodeURIComponent(body)}`;

      // Não usar canOpenURL — Android 11+ retorna false se faltar <queries>
      // no manifest, mesmo com Gmail instalado. Tentamos abrir direto e o
      // catch trata se realmente não houver app de email.
      try {
        await Linking.openURL(url);
        animateClose();
      } catch {
        await Clipboard.setStringAsync(SUPPORT_EMAIL);
        Alert.alert(
          'Sem app de email',
          `Nenhum app de email foi encontrado. O endereço ${SUPPORT_EMAIL} foi copiado pra área de transferência.`,
        );
      }
    } catch (e) {
      Alert.alert('Erro', (e as Error).message || 'Não foi possível abrir o email.');
    } finally {
      setSending(false);
    }
  }, [subject, message, animateClose]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={animateClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onPress={animateClose}
        />
        <Animated.View
          style={{
            transform: [{ translateY: sheetTranslateY }],
            backgroundColor: sheetBg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
          }}
        >
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </View>

          <View className="flex-row items-center justify-between px-5 mb-2">
            <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Contato e suporte
            </Text>
            <TouchableOpacity onPress={animateClose}>
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
            <Text className="text-xs text-gray-500 mb-3">
              Sua mensagem abrirá o app de email com o destinatário pré-preenchido.
              Você revisa e envia direto pra {SUPPORT_EMAIL}.
            </Text>

            <Text className="text-xs font-medium text-gray-500 mb-2">Assunto</Text>
            <View
              testID="support-subject-selector"
              style={{
                flexDirection: 'row',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {SUBJECTS.map(opt => {
                const active = subject === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setSubject(opt.id)}
                    activeOpacity={0.75}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      backgroundColor: active
                        ? opt.color + '18'
                        : (isDark ? '#1F2937' : '#FFFFFF'),
                      borderColor: active
                        ? opt.color
                        : (isDark ? '#374151' : '#E5E7EB'),
                    }}
                  >
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{opt.icon}</Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: active
                          ? opt.color
                          : (isDark ? '#9CA3AF' : '#6B7280'),
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="text-xs font-medium text-gray-500 mb-1.5">Mensagem</Text>
            <TextInput
              testID="support-message-input"
              className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 mb-4"
              value={message}
              onChangeText={setMessage}
              placeholder="Descreva o problema, sugestão ou pergunta..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              style={{ minHeight: 120 }}
            />

            <TouchableOpacity
              onPress={handleSend}
              disabled={sending}
              activeOpacity={0.85}
              className="bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="mail-outline" size={18} color="white" />
              <Text className="text-white font-semibold text-sm">
                {sending ? 'Abrindo email...' : 'Enviar email'}
              </Text>
            </TouchableOpacity>

            <Text className="text-xs text-gray-400 dark:text-gray-600 text-center mt-3">
              Versão do app e plataforma serão incluídas automaticamente
              pra ajudar no suporte.
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
