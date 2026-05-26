import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  Animated, Alert, ScrollView, Keyboard, Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import type { Category, Expense } from '@/contexts/DataContext';

export type PreviewMode = 'add' | 'edit';

export type PreviewInitial = {
  date: string;
  description: string;
  value_brl: number;
  value_usd: number;
  category_id: string | null;
  confidence?: 'high' | 'low';
};

type Props = {
  visible: boolean;
  mode: PreviewMode;
  initial: PreviewInitial;
  categories: Category[];
  editTarget?: Expense | null;
  onCancel: () => void;
  onBack?: () => void;
  onSave: (fields: {
    date: string;
    description: string;
    value_brl: number;
    value_usd: number;
    category_id: string | null;
  }) => Promise<void>;
};

const fmtBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export function ExpensePreviewSheet({
  visible, mode, initial, categories, editTarget,
  onCancel, onBack, onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetBg = isDark ? '#111827' : 'white';

  const slideAnim = useRef(new Animated.Value(500)).current;
  const kbOffset = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(Animated.subtract(slideAnim, kbOffset)).current;

  const [date, setDate] = useState(initial.date);
  const [description, setDescription] = useState(initial.description);
  const [valueBrl, setValueBrl] = useState(
    initial.value_brl ? String(initial.value_brl).replace('.', ',') : '',
  );
  const [valueUsd, setValueUsd] = useState(
    initial.value_usd ? String(initial.value_usd) : '',
  );
  const [categoryId, setCategoryId] = useState<string | null>(initial.category_id);
  const [saving, setSaving] = useState(false);

  const descriptionRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setDate(initial.date);
      setDescription(initial.description);
      setValueBrl(initial.value_brl ? String(initial.value_brl).replace('.', ',') : '');
      setValueUsd(initial.value_usd ? String(initial.value_usd) : '');
      setCategoryId(initial.category_id);
      kbOffset.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start(() => {
        if (mode === 'add' && !initial.description) {
          setTimeout(() => descriptionRef.current?.focus(), 80);
        }
      });
    } else {
      slideAnim.setValue(500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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
    kbOffset.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => after());
  }, [slideAnim, kbOffset]);

  const handleCancel = useCallback(() => animateClose(onCancel), [animateClose, onCancel]);
  const handleBack = useCallback(() => onBack && animateClose(onBack), [animateClose, onBack]);

  const handleSave = useCallback(async () => {
    const brl = parseFloat(valueBrl.replace(',', '.'));
    if (!description.trim()) {
      Alert.alert('Campo obrigatório', 'Preencha a descrição.');
      return;
    }
    if (isNaN(brl) || brl <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor em BRL maior que zero.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Data inválida', 'Use o formato AAAA-MM-DD (ex: 2025-01-15).');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        date,
        description: description.trim(),
        category_id: categoryId,
        value_brl: brl,
        value_usd: parseFloat(valueUsd.replace(',', '.')) || 0,
      });
      animateClose(() => { /* parent already handles closing via onSave */ });
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o gasto.');
    } finally {
      setSaving(false);
    }
  }, [date, description, valueBrl, valueUsd, categoryId, onSave, animateClose]);

  const showConfidenceBanner = mode === 'add' && initial.confidence === 'low';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onPress={handleCancel}
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
            <View className="flex-row items-center gap-2">
              {onBack && (
                <TouchableOpacity onPress={handleBack} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color="#6B7280" />
                </TouchableOpacity>
              )}
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {mode === 'add' ? 'Revisar gasto' : 'Editar categoria'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleCancel}>
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
            {showConfidenceBanner && (
              <View className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5 mb-3 mt-2 flex-row items-center gap-2">
                <Ionicons name="alert-circle-outline" size={16} color="#D97706" />
                <Text className="text-xs text-amber-700 dark:text-amber-300 flex-1">
                  Confira os campos antes de salvar — a IA pode ter chutado algum.
                </Text>
              </View>
            )}

            {mode === 'add' && (
              <>
                <Text className="text-xs font-medium text-gray-500 mb-1.5 mt-2">Descrição</Text>
                <TextInput
                  ref={descriptionRef}
                  className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 mb-3"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Ex: Almoço, Uber, Farmácia..."
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="next"
                  autoCapitalize="sentences"
                  blurOnSubmit={false}
                />

                <View className="flex-row gap-3 mb-3">
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-gray-500 mb-1.5">Valor BRL</Text>
                    <TextInput
                      testID="input-value-brl"
                      className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200"
                      value={valueBrl}
                      onChangeText={setValueBrl}
                      placeholder="0,00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-gray-500 mb-1.5">
                      Valor USD <Text className="text-gray-400 dark:text-gray-600">(opcional)</Text>
                    </Text>
                    <TextInput
                      className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200"
                      value={valueUsd}
                      onChangeText={setValueUsd}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <Text className="text-xs font-medium text-gray-500 mb-1.5">
                  Data (AAAA-MM-DD)
                </Text>
                <TextInput
                  className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 mb-3"
                  value={date}
                  onChangeText={setDate}
                  placeholder="2025-01-15"
                  placeholderTextColor="#9CA3AF"
                  maxLength={10}
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                />
              </>
            )}

            {mode === 'edit' && editTarget && (
              <View className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-4 mt-2">
                <Text className="text-sm font-medium text-gray-700 dark:text-gray-300" numberOfLines={1}>
                  {editTarget.description ?? '—'}
                </Text>
                <Text className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                  {fmtDate(editTarget.date)}  ·  {fmtBrl(editTarget.value_brl ?? 0)}
                </Text>
              </View>
            )}

            <Text className="text-xs font-medium text-gray-500 mb-2">Categoria</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              className="mb-5"
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                onPress={() => setCategoryId(null)}
                className={`px-3 py-2 rounded-xl border ${
                  categoryId === null
                    ? 'bg-gray-800 dark:bg-gray-200 border-gray-800 dark:border-gray-200'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
              >
                <Text className={`text-xs font-medium ${
                  categoryId === null ? 'text-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  Sem cat.
                </Text>
              </TouchableOpacity>

              {categories.map(c => {
                const active = categoryId === c.category_id;
                const inactiveBg = isDark ? '#1F2937' : 'white';
                const inactiveBorder = isDark ? '#374151' : '#E5E7EB';
                const inactiveText = isDark ? '#9CA3AF' : '#4B5563';
                return (
                  <TouchableOpacity
                    key={c.category_id}
                    onPress={() => setCategoryId(c.category_id)}
                    style={active
                      ? { backgroundColor: c.color + '22', borderColor: c.color, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }
                      : { backgroundColor: inactiveBg, borderColor: inactiveBorder, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }
                    }
                  >
                    <Text className="text-xs">{c.icon}</Text>
                    <Text className="text-xs font-medium" style={{ color: active ? c.color : inactiveText }}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="bg-blue-600 rounded-xl py-3.5 items-center"
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-semibold text-sm">Salvar</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
