import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal,
  Animated, Alert, ScrollView, KeyboardAvoidingView,
  Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '@/contexts/DataContext';
import type { Expense, Category } from '@/contexts/DataContext';

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── Types ─────────────────────────────────────────────────────────────────────

type ListItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'expense'; key: string; expense: Expense };

type SheetMode = 'add' | 'edit';

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const {
    expenses, categories, loading, selectedYear,
    addExpense, updateExpenseCat, deleteExpense,
  } = useData();

  // ── Month filter ───────────────────────────────────────────────────────────
  const [filterMonth, setFilterMonth] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const base = expenses.filter(e => e.date.startsWith(selectedYear));
    if (filterMonth === null) return base;
    const prefix = `${selectedYear}-${String(filterMonth).padStart(2, '0')}`;
    return base.filter(e => e.date.startsWith(prefix));
  }, [expenses, selectedYear, filterMonth]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  // Embed month-header items in the data array for FlashList
  const listData = useMemo<ListItem[]>(() => {
    const result: ListItem[] = [];
    let lastMonth = '';
    for (const e of sorted) {
      const m = e.date.slice(0, 7);
      if (m !== lastMonth) {
        const [, mo] = m.split('-');
        const label = filterMonth === null
          ? `${MONTH_LABELS[Number(mo) - 1]} ${m.slice(0, 4)}`
          : MONTH_LABELS[Number(mo) - 1];
        result.push({ type: 'header', key: `h-${m}`, label });
        lastMonth = m;
      }
      result.push({ type: 'expense', key: e.expense_id, expense: e });
    }
    return result;
  }, [sorted, filterMonth]);

  // Active months that have expenses (for filter chips)
  const activeMonths = useMemo(() => {
    const seen = new Set<number>();
    for (const e of expenses) {
      if (e.date.startsWith(selectedYear)) seen.add(Number(e.date.slice(5, 7)));
    }
    return Array.from(seen).sort((a, b) => a - b);
  }, [expenses, selectedYear]);

  // ── Category map ───────────────────────────────────────────────────────────
  const catMap = useMemo(() => {
    const m: Record<string, Category> = {};
    for (const c of categories) m[c.category_id] = c;
    return m;
  }, [categories]);

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>('add');
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const slideAnim = useRef(new Animated.Value(500)).current;

  // Add form fields
  const [date, setDate] = useState(todayIso);
  const [description, setDescription] = useState('');
  const [valueBrl, setValueBrl] = useState('');
  const [valueUsd, setValueUsd] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openSheet = useCallback((mode: SheetMode, target?: Expense) => {
    setSheetMode(mode);
    if (mode === 'add') {
      setDate(todayIso());
      setDescription('');
      setValueBrl('');
      setValueUsd('');
      setCategoryId(null);
      setEditTarget(null);
    } else if (target) {
      setEditTarget(target);
      setCategoryId(target.category_id);
    }
    setSheetVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [slideAnim]);

  const closeSheet = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 500, duration: 220, useNativeDriver: true,
    }).start(() => setSheetVisible(false));
  }, [slideAnim]);

  const handleSave = useCallback(async () => {
    if (sheetMode === 'add') {
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
        await addExpense({
          date,
          description: description.trim(),
          category_id: categoryId,
          value_brl: brl,
          value_usd: parseFloat(valueUsd.replace(',', '.')) || 0,
        });
        closeSheet();
      } catch {
        Alert.alert('Erro', 'Não foi possível salvar o gasto.');
      } finally {
        setSaving(false);
      }
    } else if (sheetMode === 'edit' && editTarget) {
      setSaving(true);
      try {
        await updateExpenseCat(editTarget.expense_id, categoryId);
        closeSheet();
      } finally {
        setSaving(false);
      }
    }
  }, [sheetMode, date, description, valueBrl, valueUsd, categoryId, editTarget,
      addExpense, updateExpenseCat, closeSheet]);

  const handleDelete = useCallback((expense: Expense) => {
    Alert.alert(
      'Excluir gasto',
      `Excluir "${expense.description ?? '…'}" (${fmtBrl(expense.value_brl ?? 0)})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => deleteExpense(expense.expense_id),
        },
      ],
    );
  }, [deleteExpense]);

  // ── Render item ────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View className="px-4 pt-5 pb-1.5">
          <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {item.label}
          </Text>
        </View>
      );
    }
    const e = item.expense;
    const cat = e.category_id ? catMap[e.category_id] : null;
    return (
      <TouchableOpacity
        className="mx-4 mb-2 bg-white rounded-xl px-4 py-3 flex-row items-center gap-3 shadow-sm"
        onPress={() => openSheet('edit', e)}
        onLongPress={() => handleDelete(e)}
        activeOpacity={0.75}
      >
        <View
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: cat?.color ?? '#94A3B8' }}
        />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>
            {e.description ?? '—'}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            {fmtDate(e.date)}{cat ? `  ·  ${cat.name}` : ''}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold font-mono text-gray-800">
            {fmtBrl(e.value_brl ?? 0)}
          </Text>
          <TouchableOpacity
            onPress={() => handleDelete(e)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [catMap, openSheet, handleDelete]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-2 flex-row items-end justify-between">
        <View>
          <Text className="text-xl font-bold text-gray-900">Gastos</Text>
          <Text className="text-sm text-gray-500">{selectedYear}</Text>
        </View>
        <Text className="text-xs text-gray-400">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Month filter chips */}
      {activeMonths.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 2 }}
          className="max-h-10 mb-2 flex-shrink-0"
        >
          <TouchableOpacity
            onPress={() => setFilterMonth(null)}
            className={`px-3 py-1.5 rounded-full ${filterMonth === null ? 'bg-blue-600' : 'bg-white border border-gray-200'}`}
          >
            <Text className={`text-xs font-medium ${filterMonth === null ? 'text-white' : 'text-gray-600'}`}>
              Todos
            </Text>
          </TouchableOpacity>
          {activeMonths.map(m => (
            <TouchableOpacity
              key={m}
              onPress={() => setFilterMonth(m)}
              className={`px-3 py-1.5 rounded-full ${filterMonth === m ? 'bg-blue-600' : 'bg-white border border-gray-200'}`}
            >
              <Text className={`text-xs font-medium ${filterMonth === m ? 'text-white' : 'text-gray-600'}`}>
                {MONTH_LABELS[m - 1]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* List / empty states */}
      {loading && !expenses.length ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-gray-400 text-sm mt-3">Carregando...</Text>
        </View>
      ) : listData.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">💸</Text>
          <Text className="text-gray-600 font-medium text-center">
            {filterMonth !== null
              ? `Nenhum gasto em ${MONTH_LABELS[filterMonth - 1]}`
              : `Nenhum gasto em ${selectedYear}`}
          </Text>
          <Text className="text-gray-400 text-sm text-center mt-1">
            Toque em + para adicionar o primeiro.
          </Text>
        </View>
      ) : (
        <FlashList
          data={listData}
          renderItem={renderItem}
          keyExtractor={item => item.key}
          getItemType={item => item.type}
          contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => openSheet('add')}
        className="absolute right-5 bg-blue-600 rounded-full w-14 h-14 items-center justify-center shadow-lg"
        style={{ bottom: insets.bottom + 20 }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* ── Bottom Sheet ──────────────────────────────────────────────────────── */}
      <Modal
        visible={sheetVisible}
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
                {/* Title row */}
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-base font-semibold text-gray-900">
                    {sheetMode === 'add' ? 'Novo gasto' : 'Editar categoria'}
                  </Text>
                  <TouchableOpacity onPress={closeSheet}>
                    <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {/* ── Add mode fields ─────────────────────────────────────── */}
                {sheetMode === 'add' && (
                  <>
                    {/* Date */}
                    <Text className="text-xs font-medium text-gray-500 mb-1.5">
                      Data (AAAA-MM-DD)
                    </Text>
                    <TextInput
                      className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 mb-3"
                      value={date}
                      onChangeText={setDate}
                      placeholder="2025-01-15"
                      placeholderTextColor="#9CA3AF"
                      maxLength={10}
                      keyboardType="numbers-and-punctuation"
                      autoCorrect={false}
                    />

                    {/* Description */}
                    <Text className="text-xs font-medium text-gray-500 mb-1.5">Descrição</Text>
                    <TextInput
                      className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800 mb-3"
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Ex: Almoço, Uber, Farmácia..."
                      placeholderTextColor="#9CA3AF"
                      returnKeyType="next"
                      autoCapitalize="sentences"
                    />

                    {/* Values row */}
                    <View className="flex-row gap-3 mb-3">
                      <View className="flex-1">
                        <Text className="text-xs font-medium text-gray-500 mb-1.5">Valor BRL</Text>
                        <TextInput
                          className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800"
                          value={valueBrl}
                          onChangeText={setValueBrl}
                          placeholder="0,00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-medium text-gray-500 mb-1.5">
                          Valor USD <Text className="text-gray-400">(opcional)</Text>
                        </Text>
                        <TextInput
                          className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-800"
                          value={valueUsd}
                          onChangeText={setValueUsd}
                          placeholder="0.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* ── Edit mode hint ──────────────────────────────────────── */}
                {sheetMode === 'edit' && editTarget && (
                  <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
                    <Text className="text-sm font-medium text-gray-700" numberOfLines={1}>
                      {editTarget.description ?? '—'}
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      {fmtDate(editTarget.date)}  ·  {fmtBrl(editTarget.value_brl ?? 0)}
                    </Text>
                  </View>
                )}

                {/* ── Category selector ───────────────────────────────────── */}
                <Text className="text-xs font-medium text-gray-500 mb-2">Categoria</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                  className="mb-4"
                >
                  <TouchableOpacity
                    onPress={() => setCategoryId(null)}
                    className={`px-3 py-2 rounded-xl border ${
                      categoryId === null
                        ? 'bg-gray-800 border-gray-800'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        categoryId === null ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      Sem cat.
                    </Text>
                  </TouchableOpacity>

                  {categories.map(c => {
                    const active = categoryId === c.category_id;
                    return (
                      <TouchableOpacity
                        key={c.category_id}
                        onPress={() => setCategoryId(c.category_id)}
                        style={active
                          ? { backgroundColor: c.color + '22', borderColor: c.color, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }
                          : { backgroundColor: 'white', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }
                        }
                      >
                        <Text className="text-xs">{c.icon}</Text>
                        <Text
                          className="text-xs font-medium"
                          style={{ color: active ? c.color : '#4B5563' }}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Save button */}
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
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
