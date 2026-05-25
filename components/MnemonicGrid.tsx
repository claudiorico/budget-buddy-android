import { View, Text } from 'react-native';

type Props = {
  words: string[];
};

export function MnemonicGrid({ words }: Props) {
  const rows = Array.from({ length: 4 }, (_, i) => words.slice(i * 3, i * 3 + 3));

  return (
    <View className="gap-2">
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} className="flex-row gap-2">
          {row.map((word, colIdx) => {
            const index = rowIdx * 3 + colIdx;
            return (
              <View
                key={index}
                className="flex-1 flex-row items-center bg-amber-50 border border-amber-200 rounded-xl px-2 py-2"
              >
                <Text className="text-xs text-amber-400 w-5 font-medium">
                  {index + 1}.
                </Text>
                <Text className="font-mono text-sm font-semibold text-amber-900 flex-1">
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
