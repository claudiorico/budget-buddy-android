import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  Animated, Alert, ScrollView, Keyboard,
  Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useData } from '@/contexts/DataContext';
import { computeGoalsProgress } from '@/lib/aggregations';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

function currentMonthLabel() {
  const d = new Date();
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function currentMonthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Color palette for new categories ─────────────────────────────────────────

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#64748B', '#78716C',
];

const PRESET_ICONS = [
  '🏠','🚗','🍔','☕','💊','🎮','✈️','👗','📱','💪','🎓','🎵',
  '🛒','🏥','💡','🐾','🌿','🎨',
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Sheet = 'goal' | 'category' | null;

// ── Main screen ───────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const insets = useSafeAreaInsets();
  const { expenses, categories, goals, loading, addGoal, deleteGoal, addCategory } = useData();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetBg = isDark ? '#111827' : 'white';

  const month = currentMonthPrefix();
  const goalsProgress = useMemo(
    () => computeGoalsProgress(expenses, goals, categories, month),
    [expenses, goals, categories, month],
  );

  // Categories already assigned a goal (to prevent duplicates)
  const usedCategoryIds = useMemo(
    () => new Set(goals.map(g => g.category_id)),
    [goals],
  );

  // Categories available for new goals
  const availableCategories = useMemo(
    () => categories.filter(c => !usedCategoryIds.has(c.category_id)),
    [categories, usedCategoryIds],
  );

  // ── Bottom sheets ──────────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<Sheet>(null);
  const slideAnim  = useRef(new Animated.Value(500)).current;
  const kbOffset   = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(Animated.subtract(slideAnim, kbOffset)).current;
  const [saving, setSaving] = useState(false);

  // Teclado — só escuta enquanto o sheet está aberto
  useEffect(() => {
    if (!sheet) { kbOffset.setValue(0); return; }
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
      Animated.timing(kbOffset, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    });
    return () => { onShow.remove(); onHide.remove(); };
  }, [sheet, kbOffset]);

  // Goal form
  const [goalCategoryId, setGoalCategoryId] = useState<string>('');
  const [monthlyLimit, setMonthlyLimit] = useState('');

  // Category form
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState(PRESET_COLORS[5]);
  const [catIcon, setCatIcon] = useState('🛒');

  const openSheet = useCallback((s: Sheet) => {
    kbOffset.setValue(0);
    setSheet(s);
    if (s === 'goal') {
      setGoalCategoryId(availableCategories[0]?.category_id ?? '');
      setMonthlyLimit('');
    } else if (s === 'category') {
      setCatName('');
      setCatColor(PRESET_COLORS[5]);
      setCatIcon('🛒');
    }
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [slideAnim, kbOffset, availableCategories]);

  const closeSheet = useCallback(() => {
    Keyboard.dismiss();
    kbOffset.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => setSheet(null));
  }, [slideAnim, kbOffset]);

  const handleAddGoal = useCallback(async () => {
    const limit = parseFloat(monthlyLimit.replace(',', '.'));
    if (!goalCategoryId) {
      Alert.alert('Selecione uma categoria');
      return;
    }
    if (isNaN(limit) || limit <= 0) {
      Alert.alert('Valor inválido', 'Informe um limite mensal maior que zero.');
      return;
    }
    setSaving(true);
    try {
      await addGoal({ category_id: goalCategoryId, monthly_limit: limit });
      closeSheet();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a meta.');
    } finally {
      setSaving(false);
    }
  }, [goalCategoryId, monthlyLimit, addGoal, closeSheet]);

  const handleAddCategory = useCallback(async () => {
    if (!catName.trim()) {
      Alert.alert('Nome obrigatório', 'Informe um nome para a categoria.');
      return;
    }
    setSaving(true);
    try {
      await addCategory({ name: catName.trim(), color: catColor, icon: catIcon });
      closeSheet();
    } catch {
      Alert.alert('Erro', 'Não foi possível criar a categoria.');
    } finally {
      setSaving(false);
    }
  }, [catName, catColor, catIcon, addCategory, closeSheet]);

  const handleDeleteGoal = useCallback((goalId: string, catName: string) => {
    Alert.alert(
      'Excluir meta',
      `Excluir a meta de "${catName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteGoal(goalId) },
      ],
    );
  }, [deleteGoal]);

  // ── Category map ───────────────────────────────────────────────────────────
  const catMap = useMemo(() => {
    const m: Record<string, typeof categories[0]> = {};
    for (const c of categories) m[c.category_id] = c;
    return m;
  }, [categories]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading && !goals.length && !categories.length) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-gray-950 items-center justify-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}>
        {/* Header */}
        <View className="px-4 pt-3 pb-4">
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">Metas</Text>
          <Text className="text-sm text-gray-500">{currentMonthLabel()}</Text>
        </View>

        {/* ── Goals section ──────────────────────────────────────────────── */}
        {goalsProgress.length === 0 ? (
          <View className="mx-4 mb-4 bg-white dark:bg-gray-900 rounded-2xl p-6 items-center shadow-sm">
            <Text className="text-3xl mb-2">🎯</Text>
            <Text className="text-gray-600 dark:text-gray-400 font-medium text-center">Nenhuma meta definida</Text>
            <Text className="text-gray-400 dark:text-gray-600 text-sm text-center mt-1">
              Defina limites mensais por categoria para acompanhar seus gastos.
            </Text>
          </View>
        ) : (
          <View className="mx-4 mb-4 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm gap-5">
            {goalsProgress.map(g => {
              const rawPct = g.monthly_limit > 0 ? (g.spent / g.monthly_limit) * 100 : 0;
              const displayPct = Math.round(rawPct);
              const barWidth = Math.min(rawPct, 100);
              const barColor =
                rawPct >= 100 ? '#EF4444' : rawPct >= 80 ? '#F59E0B' : '#10B981';

              return (
                <View key={g.goal_id}>
                  <View className="flex-row items-center justify-between mb-1.5">
                    <View className="flex-row items-center gap-2 flex-1">
                      <Text className="text-sm">
                        {catMap[g.category_id]?.icon ?? '🏷️'}
                      </Text>
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: g.category_color }}
                      />
                      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1" numberOfLines={1}>
                        {g.category_name}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <Text className="text-xs font-mono text-gray-500">
                        {fmtBrl(g.spent)} / {fmtBrl(g.monthly_limit)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteGoal(g.goal_id, g.category_name)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                    />
                  </View>

                  <View className="flex-row items-center justify-between mt-1">
                    {rawPct >= 100 && (
                      <Text className="text-xs font-medium text-red-600 dark:text-red-400">
                        🚨 Limite atingido
                      </Text>
                    )}
                    {rawPct >= 80 && rawPct < 100 && (
                      <Text className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        ⚠️ Atenção
                      </Text>
                    )}
                    {rawPct < 80 && <View />}
                    <Text className="text-xs text-gray-400 dark:text-gray-600">{displayPct}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Categories section ─────────────────────────────────────────── */}
        <View className="mx-4 mb-4 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-gray-800 dark:text-gray-200">Categorias</Text>
            <TouchableOpacity
              onPress={() => openSheet('category')}
              className="flex-row items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 rounded-lg"
            >
              <Ionicons name="add" size={14} color="#2563EB" />
              <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">Nova</Text>
            </TouchableOpacity>
          </View>

          {categories.length === 0 ? (
            <Text className="text-sm text-gray-400 dark:text-gray-600 text-center py-4">
              Nenhuma categoria. Crie uma para começar.
            </Text>
          ) : (
            <View className="gap-2">
              {categories.map(c => {
                const hasGoal = usedCategoryIds.has(c.category_id);
                return (
                  <View
                    key={c.category_id}
                    className="flex-row items-center gap-3 py-1"
                  >
                    <Text className="text-base">{c.icon}</Text>
                    <View
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <Text className="text-sm text-gray-700 dark:text-gray-300 flex-1">{c.name}</Text>
                    {hasGoal && (
                      <View className="bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                        <Text className="text-xs text-blue-600 dark:text-blue-400 font-medium">com meta</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      {availableCategories.length > 0 && (
        <TouchableOpacity
          onPress={() => openSheet('goal')}
          className="absolute right-5 bg-blue-600 rounded-full w-14 h-14 items-center justify-center shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={30} color="white" />
        </TouchableOpacity>
      )}

      {/* ── Bottom Sheets ──────────────────────────────────────────────────── */}
      <Modal
        visible={sheet !== null}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
            onPress={closeSheet}
          />
          <Animated.View
            style={{
              transform: [{ translateY: sheetTranslateY }],
              backgroundColor: sheetBg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            {/* Handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
            </View>

            {/* Título */}
            <View className="flex-row items-center justify-between px-5 mb-2">
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {sheet === 'goal' ? 'Nova meta mensal' : 'Nova categoria'}
              </Text>
              <TouchableOpacity onPress={closeSheet}>
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
              {/* ── Nova meta ───────────────────────────────────────────── */}
              {sheet === 'goal' && (
                <>
                  <Text className="text-xs font-medium text-gray-500 mb-2 mt-1">Categoria</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    keyboardShouldPersistTaps="handled"
                    className="mb-4"
                  >
                    {availableCategories.map(c => {
                      const active = goalCategoryId === c.category_id;
                      const inactiveBg = isDark ? '#1F2937' : 'white';
                      const inactiveBorder = isDark ? '#374151' : '#E5E7EB';
                      const inactiveText = isDark ? '#9CA3AF' : '#4B5563';
                      return (
                        <TouchableOpacity
                          key={c.category_id}
                          onPress={() => setGoalCategoryId(c.category_id)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                            borderWidth: 1,
                            backgroundColor: active ? c.color + '22' : inactiveBg,
                            borderColor: active ? c.color : inactiveBorder,
                          }}
                        >
                          <Text className="text-sm">{c.icon}</Text>
                          <Text
                            className="text-xs font-medium"
                            style={{ color: active ? c.color : inactiveText }}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text className="text-xs font-medium text-gray-500 mb-1.5">
                    Limite mensal em BRL
                  </Text>
                  <TextInput
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 mb-4"
                    value={monthlyLimit}
                    onChangeText={setMonthlyLimit}
                    placeholder="Ex: 500,00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />

                  <TouchableOpacity
                    onPress={handleAddGoal}
                    disabled={saving}
                    className="bg-blue-600 rounded-xl py-3.5 items-center"
                    activeOpacity={0.85}
                  >
                    {saving
                      ? <ActivityIndicator color="white" />
                      : <Text className="text-white font-semibold text-sm">Criar meta</Text>
                    }
                  </TouchableOpacity>
                </>
              )}

              {/* ── Nova categoria ───────────────────────────────────────── */}
              {sheet === 'category' && (
                <>
                  {/* Preview */}
                  <View className="flex-row items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-4 mt-1">
                    <Text className="text-2xl">{catIcon}</Text>
                    <View
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: catColor }}
                    />
                    <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {catName || 'Nome da categoria'}
                    </Text>
                  </View>

                  <Text className="text-xs font-medium text-gray-500 mb-1.5">Nome</Text>
                  <TextInput
                    className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 mb-4"
                    value={catName}
                    onChangeText={setCatName}
                    placeholder="Ex: Alimentação, Transporte..."
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="sentences"
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />

                  <Text className="text-xs font-medium text-gray-500 mb-2">Cor</Text>
                  <View className="flex-row flex-wrap gap-3 mb-4">
                    {PRESET_COLORS.map(color => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => setCatColor(color)}
                        style={{
                          width: 28, height: 28, borderRadius: 14,
                          backgroundColor: color,
                          borderWidth: catColor === color ? 3 : 0,
                          borderColor: 'white',
                          shadowColor: catColor === color ? color : 'transparent',
                          shadowOpacity: 0.5, shadowRadius: 4,
                        }}
                      />
                    ))}
                  </View>

                  <Text className="text-xs font-medium text-gray-500 mb-2">Ícone</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                    keyboardShouldPersistTaps="handled"
                    className="mb-5"
                  >
                    {PRESET_ICONS.map(icon => (
                      <TouchableOpacity
                        key={icon}
                        onPress={() => setCatIcon(icon)}
                        className={`w-10 h-10 items-center justify-center rounded-xl border ${
                          catIcon === icon
                            ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <Text className="text-lg">{icon}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TouchableOpacity
                    onPress={handleAddCategory}
                    disabled={saving}
                    className="bg-blue-600 rounded-xl py-3.5 items-center"
                    activeOpacity={0.85}
                  >
                    {saving
                      ? <ActivityIndicator color="white" />
                      : <Text className="text-white font-semibold text-sm">Criar categoria</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
