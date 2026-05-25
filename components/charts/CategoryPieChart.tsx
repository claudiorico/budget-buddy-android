import { View, Text } from 'react-native';
import { PolarChart, Pie } from 'victory-native';

type CategorySlice = {
  category_id: string | null;
  name: string;
  color: string;
  total_brl: number;
};

type Props = {
  data: CategorySlice[];
  height?: number;
};

const fmtBrl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function CategoryPieChart({ data, height = 180 }: Props) {
  if (!data.length) {
    return (
      <View className="items-center justify-center py-10">
        <Text className="text-gray-400 text-sm">Nenhum gasto no período</Text>
      </View>
    );
  }

  // PolarChart needs numeric value key + color key
  const chartData = data.map(d => ({ ...d, value: d.total_brl }));

  return (
    <View>
      <View style={{ height }}>
        <PolarChart
          data={chartData}
          labelKey="name"
          valueKey="value"
          colorKey="color"
        >
          <Pie.Chart innerRadius="50%" />
        </PolarChart>
      </View>

      {/* Legend */}
      <View className="mt-3 gap-1.5">
        {data.slice(0, 5).map(d => (
          <View key={d.category_id ?? 'none'} className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <View
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <Text className="text-xs text-gray-600 flex-1" numberOfLines={1}>
                {d.name}
              </Text>
            </View>
            <Text className="text-xs font-mono text-gray-700 ml-2">
              {fmtBrl(d.total_brl)}
            </Text>
          </View>
        ))}
        {data.length > 5 && (
          <Text className="text-xs text-gray-400 mt-0.5">
            + {data.length - 5} outras categorias
          </Text>
        )}
      </View>
    </View>
  );
}
