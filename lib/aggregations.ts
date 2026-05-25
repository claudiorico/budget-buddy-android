import type { Expense, Category, Goal } from '@/contexts/DataContext';

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

type CategoryMap = Record<string, Category>;

function catMap(categories: Category[]): CategoryMap {
  return Object.fromEntries(categories.map(c => [c.category_id, c]));
}

type CategoryTotal = {
  category_id: string | null;
  name: string;
  color: string;
  total_brl: number;
};

type Summary = {
  monthly: { total_brl: number; total_usd: number; count: number };
  yearly: { total_brl: number; total_usd: number; count: number };
  categories: CategoryTotal[];
};

export function computeSummary(
  expenses: Expense[],
  currentMonth: string,
  currentYear: string,
  categories: Category[],
): Summary {
  const map = catMap(categories);
  const monthly = expenses.filter(e => e.date.startsWith(currentMonth));
  const yearly = expenses.filter(e => e.date.startsWith(currentYear));

  const sumBrl = (arr: Expense[]) => arr.reduce((s, e) => s + (e.value_brl ?? 0), 0);
  const sumUsd = (arr: Expense[]) => arr.reduce((s, e) => s + (e.value_usd ?? 0), 0);

  const totals: Record<string, number> = {};
  for (const e of monthly) {
    const key = e.category_id ?? '__none__';
    totals[key] = (totals[key] ?? 0) + (e.value_brl ?? 0);
  }

  const categoriesData: CategoryTotal[] = (
    Object.entries(totals).map(([id, total]) => {
      if (id === '__none__') return { category_id: null, name: 'Sem categoria', color: '#64748B', total_brl: total };
      const cat = map[id];
      return cat ? { category_id: id, name: cat.name, color: cat.color, total_brl: total } : null;
    }).filter((x): x is CategoryTotal => x !== null)
  ).sort((a, b) => b.total_brl - a.total_brl);

  return {
    monthly: { total_brl: sumBrl(monthly), total_usd: sumUsd(monthly), count: monthly.length },
    yearly:  { total_brl: sumBrl(yearly),  total_usd: sumUsd(yearly),  count: yearly.length },
    categories: categoriesData,
  };
}

type MonthBar = { month: number; month_name: string; total_brl: number };

export function computeMonthlyChart(expenses: Expense[], year: string): MonthBar[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;
    const total = expenses
      .filter(e => e.date.startsWith(prefix))
      .reduce((s, e) => s + (e.value_brl ?? 0), 0);
    return { month: i + 1, month_name: MONTH_NAMES[i], total_brl: total };
  });
}

export function computeCategoryChart(
  expenses: Expense[],
  year: string,
  month: number | null,
  categories: Category[],
): CategoryTotal[] {
  const map = catMap(categories);
  const prefix = month ? `${year}-${String(month).padStart(2, '0')}` : year;
  const filtered = expenses.filter(e => e.date.startsWith(prefix));

  const totals: Record<string, number> = {};
  for (const e of filtered) {
    const key = e.category_id ?? '__none__';
    totals[key] = (totals[key] ?? 0) + (e.value_brl ?? 0);
  }

  return (
    Object.entries(totals).map(([id, total]) => {
      if (id === '__none__') return { category_id: null, name: 'Sem categoria', color: '#64748B', total_brl: total };
      const cat = map[id];
      return cat ? { category_id: id, name: cat.name, color: cat.color, total_brl: total } : null;
    }).filter((x): x is CategoryTotal => x !== null)
  ).sort((a, b) => b.total_brl - a.total_brl);
}

type GoalProgress = {
  goal_id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  monthly_limit: number;
  spent: number;
  percentage: number;
};

export function computeGoalsProgress(
  expenses: Expense[],
  goals: Goal[],
  categories: Category[],
  currentMonth: string,
): GoalProgress[] {
  const map = catMap(categories);
  const monthExpenses = expenses.filter(e => e.date.startsWith(currentMonth));

  return goals.map(goal => {
    const spent = monthExpenses
      .filter(e => e.category_id === goal.category_id)
      .reduce((s, e) => s + (e.value_brl ?? 0), 0);
    const cat = map[goal.category_id] ?? { name: 'Desconhecida', color: '#64748B' };
    return {
      goal_id: goal.goal_id,
      category_id: goal.category_id,
      category_name: cat.name,
      category_color: cat.color,
      monthly_limit: goal.monthly_limit,
      spent,
      percentage: goal.monthly_limit > 0 ? Math.min((spent / goal.monthly_limit) * 100, 100) : 0,
    };
  });
}
