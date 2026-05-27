import Constants from 'expo-constants';

const configuredPrivacyPolicyUrl =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL
  ?? Constants.expoConfig?.extra?.privacyPolicyUrl;

export const PRIVACY_POLICY_URL =
  typeof configuredPrivacyPolicyUrl === 'string'
    ? configuredPrivacyPolicyUrl.trim()
    : '';

export const hasPrivacyPolicyUrl = PRIVACY_POLICY_URL.startsWith('https://');
