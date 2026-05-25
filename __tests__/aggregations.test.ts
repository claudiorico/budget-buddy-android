/**
 * Testes das funções de agregação — operações puramente matemáticas sobre
 * arrays de gastos/categorias/metas. Nenhuma dependência de React Native.
 */
import {
  computeSummary,
  computeMonthlyChart,
  computeCategoryChart,
  computeGoalsProgress,
} from '../lib/aggregations';
import type { Expense, Category, Goal } from '../contexts/DataContext';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CATS: Category[] = [
  { category_id: 'cat-1', name: 'Alimentação', color: '#F97316', icon: '🍽️' },
  { category_id: 'cat-2', name: 'Transporte',  color: '#3B82F6', icon: '🚗' },
];

function makeExpense(
  id: string,
  date: string,
  brl: number,
  usd: number,
  catId: string | null = null,
): Expense {
  return {
    expense_id: id,
    date,
    category_id: catId,
    encrypted: false,
    description: `Gasto ${id}`,
    value_brl: brl,
    value_usd: usd,
    created_at: `${date}T12:00:00Z`,
  };
}

const EXPENSES: Expense[] = [
  // Janeiro 2025 — Alimentação: 50, Transporte: 30
  makeExpense('e1', '2025-01-10',  50,  10, 'cat-1'),
  makeExpense('e2', '2025-01-20',  30,   6, 'cat-2'),
  // Fevereiro 2025 — Alimentação: 80
  makeExpense('e3', '2025-02-05',  80,  16, 'cat-1'),
  // Março 2025 — sem categoria: 200
  makeExpense('e4', '2025-03-15', 200,  40, null),
  // Dezembro 2024 — outro ano
  makeExpense('e5', '2024-12-20', 100,  20, 'cat-2'),
];

// ── computeSummary ─────────────────────────────────────────────────────────────

describe('computeSummary', () => {
  it('total do mês correto (BRL e USD)', () => {
    const s = computeSummary(EXPENSES, '2025-01', '2025', CATS);
    expect(s.monthly.total_brl).toBe(80);   // 50 + 30
    expect(s.monthly.total_usd).toBe(16);   // 10 + 6
    expect(s.monthly.count).toBe(2);
  });

  it('total do ano correto (exclui outros anos)', () => {
    const s = computeSummary(EXPENSES, '2025-01', '2025', CATS);
    expect(s.yearly.total_brl).toBe(360);   // 50+30+80+200
    expect(s.yearly.count).toBe(4);
  });

  it('categorias ordenadas por gasto descendente', () => {
    const s = computeSummary(EXPENSES, '2025-01', '2025', CATS);
    // Jan: Alimentação=50, Transporte=30
    expect(s.categories[0].name).toBe('Alimentação');
    expect(s.categories[1].name).toBe('Transporte');
  });

  it('gasto sem categoria aparece como "Sem categoria"', () => {
    const s = computeSummary(EXPENSES, '2025-03', '2025', CATS);
    expect(s.categories[0].name).toBe('Sem categoria');
    expect(s.categories[0].total_brl).toBe(200);
    expect(s.categories[0].category_id).toBeNull();
  });

  it('retorna zeros se não há gastos no mês', () => {
    const s = computeSummary(EXPENSES, '2025-06', '2025', CATS);
    expect(s.monthly.total_brl).toBe(0);
    expect(s.monthly.count).toBe(0);
    expect(s.categories).toHaveLength(0);
  });
});

// ── computeMonthlyChart ────────────────────────────────────────────────────────

describe('computeMonthlyChart', () => {
  it('retorna sempre exatamente 12 barras', () => {
    const bars = computeMonthlyChart(EXPENSES, '2025');
    expect(bars).toHaveLength(12);
  });

  it('índice 0 = Janeiro, índice 11 = Dezembro', () => {
    const bars = computeMonthlyChart(EXPENSES, '2025');
    expect(bars[0].month_name).toBe('Jan');
    expect(bars[11].month_name).toBe('Dez');
    expect(bars[0].month).toBe(1);
    expect(bars[11].month).toBe(12);
  });

  it('total de janeiro correto', () => {
    const bars = computeMonthlyChart(EXPENSES, '2025');
    expect(bars[0].total_brl).toBe(80);     // e1(50) + e2(30)
  });

  it('total de fevereiro correto', () => {
    const bars = computeMonthlyChart(EXPENSES, '2025');
    expect(bars[1].total_brl).toBe(80);     // e3(80)
  });

  it('meses sem gasto têm total zero', () => {
    const bars = computeMonthlyChart(EXPENSES, '2025');
    expect(bars[3].total_brl).toBe(0);      // Abril sem gastos
    expect(bars[11].total_brl).toBe(0);     // Dez 2025 sem gastos
  });

  it('ano diferente → não mistura dados', () => {
    const bars2024 = computeMonthlyChart(EXPENSES, '2024');
    expect(bars2024[11].total_brl).toBe(100); // e5 em dez/2024
    expect(bars2024[0].total_brl).toBe(0);    // jan/2024 vazio
  });
});

// ── computeCategoryChart ───────────────────────────────────────────────────────

describe('computeCategoryChart', () => {
  it('filtro por ano inclui todos os meses', () => {
    const result = computeCategoryChart(EXPENSES, '2025', null, CATS);
    // 2025: cat-1=130(50+80), cat-2=30, sem-cat=200
    expect(result).toHaveLength(3);
    // Ordenado por total_brl desc
    expect(result[0].name).toBe('Sem categoria'); // 200
    expect(result[1].name).toBe('Alimentação');   // 130
    expect(result[2].name).toBe('Transporte');    // 30
  });

  it('filtro por mês específico', () => {
    // Fevereiro 2025: só e3 (Alimentação, 80)
    const result = computeCategoryChart(EXPENSES, '2025', 2, CATS);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alimentação');
    expect(result[0].total_brl).toBe(80);
  });

  it('retorna array vazio se sem gastos no período', () => {
    const result = computeCategoryChart(EXPENSES, '2023', null, CATS);
    expect(result).toHaveLength(0);
  });
});

// ── computeGoalsProgress ───────────────────────────────────────────────────────

describe('computeGoalsProgress', () => {
  const GOALS: Goal[] = [
    { goal_id: 'g1', category_id: 'cat-1', monthly_limit: 100 },
  ];

  it('percentagem correta (50% = 50 de limite 100)', () => {
    // Jan 2025: Alimentação = 50 (e1)
    const result = computeGoalsProgress(EXPENSES, GOALS, CATS, '2025-01');
    expect(result).toHaveLength(1);
    expect(result[0].spent).toBe(50);
    expect(result[0].percentage).toBe(50);
    expect(result[0].category_name).toBe('Alimentação');
  });

  it('percentagem limitada a 100 mesmo quando gasto ultrapassa', () => {
    const smallGoal: Goal[] = [
      { goal_id: 'g2', category_id: 'cat-1', monthly_limit: 10 }, // só R$ 10
    ];
    // Fev 2025: Alimentação = 80 (muito acima do limite 10)
    const result = computeGoalsProgress(EXPENSES, smallGoal, CATS, '2025-02');
    expect(result[0].percentage).toBe(100);
    expect(result[0].spent).toBe(80);
  });

  it('zero por cento se não há gastos no mês para a categoria', () => {
    // Junho 2025: sem gastos
    const result = computeGoalsProgress(EXPENSES, GOALS, CATS, '2025-06');
    expect(result[0].spent).toBe(0);
    expect(result[0].percentage).toBe(0);
  });

  it('meta com limite 0 retorna 0% (sem divisão por zero)', () => {
    const zeroGoal: Goal[] = [
      { goal_id: 'g3', category_id: 'cat-1', monthly_limit: 0 },
    ];
    const result = computeGoalsProgress(EXPENSES, zeroGoal, CATS, '2025-01');
    expect(result[0].percentage).toBe(0);
  });

  it('retorna um item por meta', () => {
    const twoGoals: Goal[] = [
      { goal_id: 'g1', category_id: 'cat-1', monthly_limit: 100 },
      { goal_id: 'g2', category_id: 'cat-2', monthly_limit: 50 },
    ];
    const result = computeGoalsProgress(EXPENSES, twoGoals, CATS, '2025-01');
    expect(result).toHaveLength(2);
  });
});
