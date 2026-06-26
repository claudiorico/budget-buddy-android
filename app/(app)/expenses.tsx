import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator, AppState,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '@/contexts/DataContext';
import type { Expense, Category } from '@/contexts/DataContext';
import { ExpenseInputSheet } from '@/components/ExpenseInputSheet';
import { ExpensePreviewSheet, type PreviewInitial } from '@/components/ExpensePreviewSheet';
import type { ExpenseDraft } from '@/lib/ai';
import * as NotificationListener from '@/modules/notification-listener/src';

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

const EMPTY_PREVIEW: PreviewInitial = {
  date: '', description: '', value_brl: 0, value_usd: 0, category_id: null,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ListItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'expense'; key: string; expense: Expense };

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ shareText?: string }>();
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

  const activeMonths = useMemo(() => {
    const seen = new Set<number>();
    for (const e of expenses) {
      if (e.date.startsWith(selectedYear)) seen.add(Number(e.date.slice(5, 7)));
    }
    return Array.from(seen).sort((a, b) => a - b);
  }, [expenses, selectedYear]);

  const catMap = useMemo(() => {
    const m: Record<string, Category> = {};
    for (const c of categories) m[c.category_id] = c;
    return m;
  }, [categories]);

  // ── Sheet state ────────────────────────────────────────────────────────────
  // 'input' = choose voz/texto/manual
  // 'preview' = review fields and save
  const [inputVisible, setInputVisible] = useState(false);
  const [inputInitialText, setInputInitialText] = useState<string | undefined>(undefined);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewInitial, setPreviewInitial] = useState<PreviewInitial>(EMPTY_PREVIEW);
  const [previewMode, setPreviewMode] = useState<'add' | 'edit'>('add');
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [pendingCaptures, setPendingCaptures] = useState<string[]>([]);
  const [captureBeingImported, setCaptureBeingImported] = useState<string | null>(null);

  // ── Handle incoming share intent ───────────────────────────────────────────
  useEffect(() => {
    const text = params.shareText;
    if (text && typeof text === 'string' && text.trim()) {
      setInputInitialText(text);
      setInputVisible(true);
      router.setParams({ shareText: undefined });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.shareText]);

  const refreshPendingCaptures = useCallback(() => {
    setPendingCaptures(NotificationListener.getPendingNotifications());
  }, []);

  useEffect(() => {
    refreshPendingCaptures();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPendingCaptures();
    });
    return () => sub.remove();
  }, [refreshPendingCaptures]);

  const openInput = useCallback(() => {
    setInputInitialText(undefined);
    setCaptureBeingImported(null);
    setInputVisible(true);
  }, []);

  const importCapture = useCallback((text: string) => {
    setCaptureBeingImported(text);
    setInputInitialText(text);
    setInputVisible(true);
  }, []);

  const ignoreCapture = useCallback((text: string) => {
    NotificationListener.removePendingNotification(text);
    setPendingCaptures(NotificationListener.getPendingNotifications());
  }, []);

  const openManualPreview = useCallback(() => {
    setInputVisible(false);
    setPreviewMode('add');
    setEditTarget(null);
    setPreviewInitial({
      date: todayIso(),
      description: '',
      value_brl: 0,
      value_usd: 0,
      category_id: null,
    });
    setPreviewVisible(true);
  }, []);

  const openEditPreview = useCallback((expense: Expense) => {
    setPreviewMode('edit');
    setEditTarget(expense);
    setPreviewInitial({
      date: expense.date,
      description: expense.description ?? '',
      value_brl: expense.value_brl ?? 0,
      value_usd: expense.value_usd ?? 0,
      category_id: expense.category_id,
    });
    setPreviewVisible(true);
  }, []);

  const handleParsed = useCallback((draft: ExpenseDraft) => {
    setInputVisible(false);
    setPreviewMode('add');
    setEditTarget(null);
    setPreviewInitial({
      date: draft.date,
      description: draft.description,
      value_brl: draft.value_brl,
      value_usd: draft.value_usd,
      category_id: draft.category_id,
      confidence: draft._confidence,
    });
    setPreviewVisible(true);
  }, []);

  const handleSave = useCallback(async (fields: {
    date: string;
    description: string;
    value_brl: number;
    value_usd: number;
    category_id: string | null;
  }) => {
    if (previewMode === 'add') {
      await addExpense(fields);
      if (captureBeingImported) {
        NotificationListener.removePendingNotification(captureBeingImported);
        setCaptureBeingImported(null);
        refreshPendingCaptures();
      }
    } else if (previewMode === 'edit' && editTarget) {
      await updateExpenseCat(editTarget.expense_id, fields.category_id);
    }
    setPreviewVisible(false);
  }, [previewMode, editTarget, captureBeingImported, addExpense, updateExpenseCat, refreshPendingCaptures]);

  const handlePreviewBack = useCallback(() => {
    setPreviewVisible(false);
    setInputVisible(true);
  }, []);

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
          <Text className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
            {item.label}
          </Text>
        </View>
      );
    }
    const e = item.expense;
    const cat = e.category_id ? catMap[e.category_id] : null;
    return (
      <TouchableOpacity
        className="mx-4 mb-2 bg-white dark:bg-gray-900 rounded-xl px-4 py-3 flex-row items-center gap-3 shadow-sm"
        onPress={() => openEditPreview(e)}
        onLongPress={() => handleDelete(e)}
        activeOpacity={0.75}
      >
        <View
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: cat?.color ?? '#94A3B8' }}
        />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-gray-800 dark:text-gray-200" numberOfLines={1}>
            {e.description ?? '—'}
          </Text>
          <Text className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
            {fmtDate(e.date)}{cat ? `  ·  ${cat.name}` : ''}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold font-mono text-gray-800 dark:text-gray-200">
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
  }, [catMap, openEditPreview, handleDelete]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-2 flex-row items-end justify-between">
        <View>
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">Gastos</Text>
          <Text className="text-sm text-gray-500">{selectedYear}</Text>
        </View>
        <Text className="text-xs text-gray-400 dark:text-gray-600">
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
            className={`px-3 py-1.5 rounded-full ${filterMonth === null ? 'bg-blue-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}
          >
            <Text className={`text-xs font-medium ${filterMonth === null ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
              Todos
            </Text>
          </TouchableOpacity>
          {activeMonths.map(m => (
            <TouchableOpacity
              key={m}
              onPress={() => setFilterMonth(m)}
              className={`px-3 py-1.5 rounded-full ${filterMonth === m ? 'bg-blue-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}
            >
              <Text className={`text-xs font-medium ${filterMonth === m ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                {MONTH_LABELS[m - 1]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {pendingCaptures.length > 0 && (
        <View className="mx-4 mb-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-4">
          <View className="flex-row items-center justify-between gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-sm font-bold text-amber-900 dark:text-amber-100">
                Lançamentos capturados
              </Text>
              <Text className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {pendingCaptures.length} notificação{pendingCaptures.length !== 1 ? 'ões' : ''} aguardando revisão
              </Text>
            </View>
            <TouchableOpacity onPress={refreshPendingCaptures} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="refresh" size={18} color="#92400E" />
            </TouchableOpacity>
          </View>

          {pendingCaptures.slice(0, 3).map((text) => (
            <View key={text} className="bg-white/80 dark:bg-gray-950/60 rounded-xl p-3 mb-2">
              <Text className="text-xs text-gray-700 dark:text-gray-300" numberOfLines={2}>
                {text}
              </Text>
              <View className="flex-row justify-end gap-2 mt-3">
                <TouchableOpacity
                  onPress={() => ignoreCapture(text)}
                  className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800"
                >
                  <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">Ignorar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => importCapture(text)}
                  className="px-3 py-1.5 rounded-full bg-amber-600"
                >
                  <Text className="text-xs font-semibold text-white">Importar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {pendingCaptures.length > 3 && (
            <Text className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              +{pendingCaptures.length - 3} captura{pendingCaptures.length - 3 !== 1 ? 's' : ''} na fila
            </Text>
          )}
        </View>
      )}

      {/* List / empty states */}
      {loading && !expenses.length ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-gray-400 dark:text-gray-600 text-sm mt-3">Carregando...</Text>
        </View>
      ) : listData.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">💸</Text>
          <Text className="text-gray-600 dark:text-gray-400 font-medium text-center">
            {filterMonth !== null
              ? `Nenhum gasto em ${MONTH_LABELS[filterMonth - 1]}`
              : `Nenhum gasto em ${selectedYear}`}
          </Text>
          <Text className="text-gray-400 dark:text-gray-600 text-sm text-center mt-1">
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
        testID="fab-add-expense"
        onPress={openInput}
        className="absolute right-5 bg-blue-600 rounded-full w-14 h-14 items-center justify-center shadow-lg"
        style={{ bottom: insets.bottom + 20 }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      <ExpenseInputSheet
        visible={inputVisible}
        categories={categories}
        initialText={inputInitialText}
        onCancel={() => setInputVisible(false)}
        onManual={openManualPreview}
        onParsed={handleParsed}
      />

      <ExpensePreviewSheet
        visible={previewVisible}
        mode={previewMode}
        initial={previewInitial}
        categories={categories}
        editTarget={editTarget}
        onCancel={() => setPreviewVisible(false)}
        onBack={previewMode === 'add' ? handlePreviewBack : undefined}
        onSave={handleSave}
      />
    </View>
  );
}
