import { View, Text } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';

type MonthBar = {
  month: number;
  month_name: string;
  total_brl: number;
};

const MONTH_ABBR = ['J','F','M','A','M','J','J','A','S','O','N','D'];

type Props = {
  data: MonthBar[];
  height?: number;
};

export function MonthlyBarChart({ data, height = 180 }: Props) {
  if (!data.length) return null;

  const maxVal = Math.max(...data.map(d => d.total_brl), 1);

  return (
    <View>
      <View style={{ height }}>
        <CartesianChart
          data={data}
          xKey="month"
          yKeys={['total_brl']}
          domain={{ y: [0, maxVal * 1.1] }}
          padding={{ left: 4, right: 4, top: 8, bottom: 0 }}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.total_brl}
              chartBounds={chartBounds}
              color="#2563EB"
              roundedCorners={{ topLeft: 4, topRight: 4 }}
              barWidth={20}
            />
          )}
        </CartesianChart>
      </View>

      {/* Month labels below chart */}
      <View className="flex-row justify-around mt-1 px-1">
        {MONTH_ABBR.map((m, i) => (
          <Text key={i} className="text-xs text-gray-400 dark:text-gray-600 w-5 text-center">
            {m}
          </Text>
        ))}
      </View>
    </View>
  );
}
