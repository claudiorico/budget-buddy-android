import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const { signIn, loading } = useAuth();

  return (
    <View className="flex-1 bg-white justify-between px-8 py-16">
      {/* Header */}
      <View className="items-center mt-12">
        <View className="w-20 h-20 rounded-2xl bg-blue-600 items-center justify-center mb-6">
          <Text className="text-white text-4xl">💰</Text>
        </View>
        <Text className="text-3xl font-bold text-gray-900 tracking-tight">
          Budget Buddy
        </Text>
        <Text className="text-base text-gray-500 mt-2 text-center leading-relaxed">
          Seus gastos, sua privacidade.{'\n'}Dados criptografados no seu Google Drive.
        </Text>
      </View>

      {/* Features */}
      <View className="gap-4">
        {[
          { icon: '🔒', text: 'Criptografia AES-256 no seu dispositivo' },
          { icon: '☁️', text: 'Sincronizado no seu Google Drive' },
          { icon: '🔑', text: 'Zero acesso do desenvolvedor' },
        ].map(({ icon, text }) => (
          <View key={text} className="flex-row items-center gap-3">
            <Text className="text-2xl">{icon}</Text>
            <Text className="text-sm text-gray-600 flex-1">{text}</Text>
          </View>
        ))}
      </View>

      {/* Sign-in button */}
      <View className="gap-4">
        <TouchableOpacity
          onPress={signIn}
          disabled={loading}
          activeOpacity={0.85}
          className="bg-blue-600 rounded-2xl py-4 flex-row items-center justify-center gap-3"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-2xl">G</Text>
              <Text className="text-white font-semibold text-base">
                Entrar com Google
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text className="text-xs text-gray-400 text-center">
          Apenas as permissões de perfil e Google Drive (appdata) são solicitadas.
        </Text>
      </View>
    </View>
  );
}
