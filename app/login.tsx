import { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { hasPrivacyPolicyUrl, PRIVACY_POLICY_URL } from '@/constants/legal';

export default function LoginScreen() {
  const { signIn, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  return (
    <View className="flex-1 bg-white dark:bg-gray-900 justify-between px-8 py-16">
      <View className="items-center mt-12">
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: 96, height: 96, borderRadius: 20, marginBottom: 24 }}
          resizeMode="cover"
        />
        <Text className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          Gestão Financeira
        </Text>
        <Text className="text-base text-gray-500 mt-2 text-center leading-relaxed">
          Seus gastos, sua privacidade.{'\n'}Dados criptografados no seu Google Drive.
        </Text>
      </View>

      <View className="gap-4">
        {[
          { icon: 'lock-closed-outline', text: 'Criptografia AES-256 no seu dispositivo' },
          { icon: 'cloud-outline', text: 'Sincronizado no seu Google Drive' },
          { icon: 'key-outline', text: 'Zero acesso do desenvolvedor' },
        ].map(({ icon, text }) => (
          <View key={text} className="flex-row items-center gap-3">
            <Ionicons name={icon as any} size={22} color="#F59E0B" />
            <Text className="text-sm text-gray-600 dark:text-gray-400 flex-1">{text}</Text>
          </View>
        ))}
      </View>

      <View className="gap-4">
        <TouchableOpacity
          onPress={signIn}
          disabled={loading}
          activeOpacity={0.85}
          className="bg-orange-600 rounded-2xl py-4 flex-row items-center justify-center gap-3"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="white" />
              <Text className="text-white font-semibold text-base">
                Entrar com Google
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text className="text-xs text-gray-400 dark:text-gray-600 text-center">
          Apenas as permissões de perfil e Google Drive (appdata) são solicitadas.
        </Text>
        {hasPrivacyPolicyUrl && (
          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            className="items-center"
          >
            <Text className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Política de Privacidade
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
