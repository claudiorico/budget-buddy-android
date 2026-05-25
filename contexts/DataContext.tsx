import {
  createContext, useContext, useState,
  useEffect, useCallback, ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useVault } from './VaultContext';
import { getDek, decryptExpenses as cryptoDecryptExpenses } from '@/lib/crypto';
import * as drive from '@/lib/drive';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Category = {
  category_id: string;
  name: string;
  color: string;
  icon: string;
};

export type Goal = {
  goal_id: string;
  category_id: string;
  monthly_limit: number;
};

export type Expense = {
  expense_id: string;
  date: string;
  category_id: string | null;
  encrypted: boolean;
  // Encrypted (on Drive)
  description_enc?: string;
  value_usd_enc?: string;
  value_brl_enc?: string;
  // Decrypted (in memory only — never persisted)
  description?: string;
  value_usd?: number;
  value_brl?: number;
  created_at: string;
};

type DataContextType = {
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
  loading: boolean;
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  refresh: () => Promise<void>;
  // Phase 4 CRUD
  addExpense: (fields: { date: string; category_id: string | null; description: string; value_usd: number; value_brl: number }) => Promise<void>;
  updateExpenseCat: (expense_id: string, category_id: string | null) => Promise<void>;
  deleteExpense: (expense_id: string) => Promise<void>;
  addCategory: (fields: { name: string; color: string; icon: string }) => Promise<void>;
  addGoal: (fields: { category_id: string; monthly_limit: number }) => Promise<void>;
  deleteGoal: (goal_id: string) => Promise<void>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function expenseFileName(year: string) {
  return `expenses_${year}.json`;
}

function formatYear() {
  return new Date().getFullYear().toString();
}

// Categorias padrão carregadas na primeira vez que o usuário abre o vault.
// IDs fixos (não UUIDs) evitam duplicatas caso o seed seja chamado duas vezes.
const DEFAULT_CATEGORIES: Category[] = [
  { category_id: 'cat-alimentacao', name: 'Alimentação',  color: '#F97316', icon: '🍽️' },
  { category_id: 'cat-transporte',  name: 'Transporte',   color: '#3B82F6', icon: '🚗' },
  { category_id: 'cat-saude',       name: 'Saúde',        color: '#22C55E', icon: '💊' },
  { category_id: 'cat-lazer',       name: 'Lazer',        color: '#A855F7', icon: '🎬' },
  { category_id: 'cat-moradia',     name: 'Moradia',      color: '#EF4444', icon: '🏠' },
  { category_id: 'cat-vestuario',   name: 'Vestuário',    color: '#EC4899', icon: '👕' },
  { category_id: 'cat-educacao',    name: 'Educação',     color: '#F59E0B', icon: '📚' },
  { category_id: 'cat-outros',      name: 'Outros',       color: '#6B7280', icon: '📦' },
];

// ── Context ───────────────────────────────────────────────────────────────────

const DataContext = createContext<DataContextType | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function DataProvider({ children }: { children: ReactNode }) {
  const { getAccessToken } = useAuth();
  const { status, dekVersion } = useVault();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(formatYear);

  // ── Core fetch ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (year: string) => {
    const dek = getDek();
    if (!dek || status !== 'unlocked') {
      setExpenses([]);
      setCategories([]);
      setGoals([]);
      return;
    }

    setLoading(true);
    try {
      const token = await getAccessToken();

      const [rawExpenses, cats, gls] = await Promise.all([
        drive.readFile<Expense[]>(token, expenseFileName(year)),
        drive.readFile<Category[]>(token, 'categories.json'),
        drive.readFile<Goal[]>(token, 'goals.json'),
      ]);

      // Primeira vez: categories.json não existe → seed das categorias padrão
      let resolvedCats = cats;
      if (!resolvedCats) {
        try {
          await drive.writeFile(token, 'categories.json', DEFAULT_CATEGORIES);
          resolvedCats = DEFAULT_CATEGORIES;
        } catch {
          resolvedCats = DEFAULT_CATEGORIES; // usa em memória mesmo se o write falhar
        }
      }

      setCategories(resolvedCats);
      setGoals(gls ?? []);

      if (rawExpenses && rawExpenses.length > 0) {
        // decryptExpenses expects EncryptedExpense[] — Expense is structurally compatible
        const decrypted = await cryptoDecryptExpenses(dek, rawExpenses as any);
        setExpenses(decrypted as unknown as Expense[]);
      } else {
        setExpenses([]);
      }
    } catch (e) {
      console.error('DataContext fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [status, getAccessToken]);

  // Re-fetch when vault unlocks or year changes
  useEffect(() => {
    if (status === 'unlocked') fetchAll(selectedYear);
    if (status === 'locked' || status === 'loading') {
      setExpenses([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dekVersion, selectedYear]);

  const refresh = useCallback(() => fetchAll(selectedYear), [fetchAll, selectedYear]);

  // ── Helpers to write expenses to Drive ────────────────────────────────────

  const persistExpenses = async (next: Expense[], year: string) => {
    // Store only encrypted fields — strip decrypted plaintext before upload
    const safe = next.map(({ description, value_usd, value_brl, ...rest }) => rest);
    const token = await getAccessToken();
    await drive.writeFile(token, expenseFileName(year), safe);
  };

  // ── Phase 4 CRUD ─────────────────────────────────────────────────────────

  const addExpense = useCallback(async (fields: {
    date: string;
    category_id: string | null;
    description: string;
    value_usd: number;
    value_brl: number;
  }) => {
    const dek = getDek();
    if (!dek) throw new Error('Vault locked');
    const { encryptExpenseFields } = await import('@/lib/crypto');
    const { v4: uuidv4 } = await import('uuid');
    const encFields = await encryptExpenseFields(dek, fields);
    const expense: Expense = {
      expense_id: uuidv4(),
      date: fields.date,
      category_id: fields.category_id,
      ...encFields,
      description: fields.description,
      value_usd: fields.value_usd,
      value_brl: fields.value_brl,
      created_at: new Date().toISOString(),
    };
    const year = fields.date.slice(0, 4);
    const yearExpenses = year === selectedYear
      ? [...expenses, expense]
      : expenses; // different year: will be fetched on demand
    if (year === selectedYear) {
      setExpenses(yearExpenses);
      await persistExpenses(yearExpenses, year);
    } else {
      // Fetch that year's expenses, append, save
      const token = await getAccessToken();
      const raw = await drive.readFile<Expense[]>(token, expenseFileName(year)) ?? [];
      raw.push(expense);
      await drive.writeFile(token, expenseFileName(year), raw.map(
        ({ description, value_usd, value_brl, ...rest }) => rest,
      ));
    }
  }, [expenses, selectedYear, getAccessToken]);

  const updateExpenseCat = useCallback(async (expense_id: string, category_id: string | null) => {
    const next = expenses.map(e =>
      e.expense_id === expense_id ? { ...e, category_id } : e,
    );
    setExpenses(next);
    await persistExpenses(next, selectedYear);
  }, [expenses, selectedYear, getAccessToken]);

  const deleteExpense = useCallback(async (expense_id: string) => {
    const next = expenses.filter(e => e.expense_id !== expense_id);
    setExpenses(next);
    await persistExpenses(next, selectedYear);
  }, [expenses, selectedYear, getAccessToken]);

  const addCategory = useCallback(async (fields: { name: string; color: string; icon: string }) => {
    const { v4: uuidv4 } = await import('uuid');
    const cat: Category = { category_id: uuidv4(), ...fields };
    const next = [...categories, cat];
    setCategories(next);
    const token = await getAccessToken();
    await drive.writeFile(token, 'categories.json', next);
  }, [categories, getAccessToken]);

  const addGoal = useCallback(async (fields: { category_id: string; monthly_limit: number }) => {
    const { v4: uuidv4 } = await import('uuid');
    const goal: Goal = { goal_id: uuidv4(), ...fields };
    const next = [...goals, goal];
    setGoals(next);
    const token = await getAccessToken();
    await drive.writeFile(token, 'goals.json', next);
  }, [goals, getAccessToken]);

  const deleteGoal = useCallback(async (goal_id: string) => {
    const next = goals.filter(g => g.goal_id !== goal_id);
    setGoals(next);
    const token = await getAccessToken();
    await drive.writeFile(token, 'goals.json', next);
  }, [goals, getAccessToken]);

  return (
    <DataContext.Provider value={{
      expenses, categories, goals, loading,
      selectedYear, setSelectedYear,
      refresh,
      addExpense, updateExpenseCat, deleteExpense,
      addCategory, addGoal, deleteGoal,
    }}>
      {children}
    </DataContext.Provider>
  );
}
