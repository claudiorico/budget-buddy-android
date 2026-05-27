import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Animated,
  Pressable, Keyboard, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import {
  PIX_KEY, PIX_KEY_TYPE, PIX_RECIPIENT, PIX_INSTITUTION,
  BTC_ADDRESS, BTC_NETWORK,
} from '@/lib/contact';

type Tab = 'pix' | 'btc';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function DonationSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetBg = isDark ? '#111827' : 'white';

  const [tab, setTab] = useState<Tab>('pix');
  const [copiedTarget, setCopiedTarget] = useState<Tab | null>(null);

  const slideAnim = useRef(new Animated.Value(500)).current;
  const kbOffset = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(Animated.subtract(slideAnim, kbOffset)).current;

  useEffect(() => {
    if (visible) {
      setTab('pix');
      setCopiedTarget(null);
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
    Animated.timing(slideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => onClose());
  }, [slideAnim, onClose]);

  const handleCopy = useCallback(async (target: Tab) => {
    const value = target === 'pix' ? PIX_KEY : BTC_ADDRESS;
    await Clipboard.setStringAsync(value);
    setCopiedTarget(target);
    setTimeout(() => setCopiedTarget(null), 2500);
  }, []);

  const qrValue = tab === 'pix' ? PIX_KEY : BTC_ADDRESS;
  const qrColor = isDark ? '#F3F4F6' : '#111827';
  const qrBgColor = isDark ? '#1F2937' : '#FFFFFF';

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
              Apoie o desenvolvedor
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
            <Text className="text-xs text-gray-500 mb-4">
              O app é grátis e sem anúncios. Se ele te ajuda, considere contribuir.
            </Text>

            {/* Tabs PIX / BTC */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                borderRadius: 12,
                padding: 4,
                marginBottom: 16,
              }}
            >
              {(['pix', 'btc'] as Tab[]).map(opt => {
                const active = tab === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setTab(opt)}
                    activeOpacity={0.75}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: active
                        ? (isDark ? '#374151' : '#FFFFFF')
                        : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{opt === 'pix' ? '💸' : '₿'}</Text>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color: active
                          ? (isDark ? '#60A5FA' : '#2563EB')
                          : '#6B7280',
                      }}
                    >
                      {opt === 'pix' ? 'PIX' : 'Bitcoin'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* QR Code */}
            <View
              style={{
                alignItems: 'center',
                padding: 20,
                backgroundColor: qrBgColor,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? '#374151' : '#E5E7EB',
                marginBottom: 16,
              }}
            >
              <QRCode
                value={qrValue}
                size={200}
                color={qrColor}
                backgroundColor={qrBgColor}
              />
            </View>

            {/* Detalhes + Chave */}
            {tab === 'pix' ? (
              <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-xs text-gray-500 mb-1">Recebedor</Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {PIX_RECIPIENT} · {PIX_INSTITUTION}
                </Text>
                <Text className="text-xs text-gray-500 mb-1">
                  Chave PIX ({PIX_KEY_TYPE})
                </Text>
                <Text
                  className="text-xs font-mono text-gray-700 dark:text-gray-300"
                  selectable
                >
                  {PIX_KEY}
                </Text>
              </View>
            ) : (
              <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-3">
                <Text className="text-xs text-gray-500 mb-1">Rede</Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                  {BTC_NETWORK}
                </Text>
                <Text className="text-xs text-gray-500 mb-1">Endereço</Text>
                <Text
                  className="text-xs font-mono text-gray-700 dark:text-gray-300"
                  selectable
                >
                  {BTC_ADDRESS}
                </Text>
              </View>
            )}

            {/* Botão copiar */}
            <TouchableOpacity
              testID="donation-copy-btn"
              onPress={() => handleCopy(tab)}
              activeOpacity={0.85}
              className={`flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                copiedTarget === tab
                  ? 'bg-green-100 dark:bg-green-950'
                  : 'bg-blue-600'
              }`}
            >
              <Ionicons
                name={copiedTarget === tab ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={copiedTarget === tab ? '#10B981' : 'white'}
              />
              <Text
                className={`font-semibold text-sm ${
                  copiedTarget === tab
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-white'
                }`}
              >
                {copiedTarget === tab
                  ? 'Copiado!'
                  : tab === 'pix' ? 'Copiar chave PIX' : 'Copiar endereço'}
              </Text>
            </TouchableOpacity>

            <Text className="text-xs text-gray-400 dark:text-gray-600 text-center mt-3 px-2">
              {tab === 'pix'
                ? 'Aponte sua câmera do banco para o QR Code ou cole a chave no app do banco.'
                : 'Envie apenas Bitcoin (BTC) para este endereço. Outros ativos serão perdidos para sempre.'}
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
