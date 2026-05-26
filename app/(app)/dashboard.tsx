import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  computeSummary, computeMonthlyChart,
  computeCategoryChart, computeGoalsProgress,
} from '@/lib/aggregations';
import { MonthlyBarChart } from '@/components/charts/MonthlyBarChart';
import { CategoryPieChart } from '@/components/charts/CategoryPieChart';

const fmtBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0);

const fmtUsd = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0);

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    expenses, categories, goals,
    loading, selectedYear, setSelectedYear, refresh,
  } = useData();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => (currentYear - i).toString());
  const month = currentMonth();

  const summary       = computeSummary(expenses, month, selectedYear, categories);
  const monthlyChart  = computeMonthlyChart(expenses, selectedYear);
  const categoryChart = computeCategoryChart(expenses, selectedYear, null, categories);
  const goalsProgress = computeGoalsProgress(expenses, goals, categories, month);

  const alerts = goalsProgress.filter(g => g.percentage >= 80);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-950"
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#2563EB" />}
    >
      {/* Header */}
      <View className="px-4 mb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Olá, {user?.name?.split(' ')[0] ?? 'usuário'} 👋
          </Text>
          <Text className="text-sm text-gray-500">Dashboard financeiro</Text>
        </View>

        {/* Year picker */}
        <View className="flex-row gap-1">
          {years.map(y => (
            <TouchableOpacity
              key={y}
              onPress={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-lg ${selectedYear === y ? 'bg-blue-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}
            >
              <Text className={`text-xs font-medium ${selectedYear === y ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading && !expenses.length ? (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="text-gray-400 dark:text-gray-600 text-sm mt-3">Carregando dados...</Text>
        </View>
      ) : (
        <>
          {/* ── Goal alerts ─────────────────────────────────────────────── */}
          {alerts.length > 0 && (
            <View className="px-4 mb-4 gap-2">
              {alerts.map(g => (
                <View
                  key={g.goal_id}
                  className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                    g.percentage >= 100
                      ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                      : 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <Text className="text-base">{g.percentage >= 100 ? '🚨' : '⚠️'}</Text>
                  <Text
                    className={`text-xs font-medium flex-1 ${
                      g.percentage >= 100 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {g.category_name}: {Math.round(g.percentage)}% da meta mensal
                    {g.percentage >= 100 ? ' — limite atingido!' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Summary cards ────────────────────────────────────────────── */}
          <View className="px-4 mb-4">
            <View className="flex-row gap-3">
              {/* Mensal BRL */}
              <View className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
                <Text className="text-xs text-gray-400 dark:text-gray-600 mb-1">Gasto no mês</Text>
                <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                  {fmtBrl(summary.monthly.total_brl)}
                </Text>
                <Text className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                  {fmtUsd(summary.monthly.total_usd)}
                </Text>
                <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {summary.monthly.count} transações
                </Text>
              </View>

              {/* Anual BRL */}
              <View className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
                <Text className="text-xs text-gray-400 dark:text-gray-600 mb-1">Gasto em {selectedYear}</Text>
                <Text className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
                  {fmtBrl(summary.yearly.total_brl)}
                </Text>
                <Text className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                  {fmtUsd(summary.yearly.total_usd)}
                </Text>
                <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {summary.yearly.count} transações
                </Text>
              </View>
            </View>
          </View>

          {/* ── Monthly bar chart ────────────────────────────────────────── */}
          <View className="mx-4 mb-4 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
            <Text className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Gastos por mês — {selectedYear}
            </Text>
            {monthlyChart.every(m => m.total_brl === 0) ? (
              <View className="items-center py-6">
                <Text className="text-gray-400 dark:text-gray-600 text-sm">Nenhum gasto em {selectedYear}</Text>
              </View>
            ) : (
              <MonthlyBarChart data={monthlyChart} />
            )}
          </View>

          {/* ── Category pie chart ───────────────────────────────────────── */}
          <View className="mx-4 mb-4 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
            <Text className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Gastos por categoria — {selectedYear}
            </Text>
            <CategoryPieChart data={categoryChart} />
          </View>

          {/* ── Goals progress ───────────────────────────────────────────── */}
          {goalsProgress.length > 0 && (
            <View className="mx-4 mb-4 bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
              <Text className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
                Metas do mês
              </Text>
              <View className="gap-4">
                {goalsProgress.map(g => (
                  <View key={g.goal_id}>
                    <View className="flex-row items-center justify-between mb-1.5">
                      <View className="flex-row items-center gap-2">
                        <View
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: g.category_color }}
                        />
                        <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {g.category_name}
                        </Text>
                      </View>
                      <Text className="text-xs font-mono text-gray-500">
                        {fmtBrl(g.spent)} / {fmtBrl(g.monthly_limit)}
                      </Text>
                    </View>

                    {/* Progress bar */}
                    <View className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(g.percentage, 100)}%`,
                          backgroundColor:
                            g.percentage >= 100 ? '#EF4444'
                            : g.percentage >= 80  ? '#F59E0B'
                            : '#10B981',
                        }}
                      />
                    </View>

                    <Text className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 text-right">
                      {Math.round(g.percentage)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Empty state */}
          {!expenses.length && !loading && (
            <View className="items-center py-10 px-8">
              <Text className="text-4xl mb-3">💸</Text>
              <Text className="text-gray-600 dark:text-gray-400 font-medium text-center">
                Nenhum gasto registrado em {selectedYear}
              </Text>
              <Text className="text-gray-400 dark:text-gray-600 text-sm text-center mt-1">
                Vá para a aba Gastos para adicionar o primeiro.
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
