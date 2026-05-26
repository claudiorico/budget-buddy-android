import { View, Text } from 'react-native';

type Props = {
  words: string[];
};

export function MnemonicGrid({ words }: Props) {
  const rows = Array.from({ length: 4 }, (_, i) => words.slice(i * 3, i * 3 + 3));

  return (
    <View className="gap-2.5">
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row gap-2">
          {row.map((word, colIdx) => {
            const index = rowIdx * 3 + colIdx;
            return (
              <View
                key={index}
                className="flex-1 flex-row items-center bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-2.5 py-3"
              >
                <Text className="text-sm text-amber-500 dark:text-amber-400 w-6 font-semibold">
                  {index + 1}.
                </Text>
                <Text className="font-mono text-base font-bold text-amber-900 dark:text-amber-100 flex-1">
                  {word}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
