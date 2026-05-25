import { createMMKV } from 'react-native-mmkv';

// Singleton MMKV instance — only for non-sensitive data
// NEVER store DEK, passwords, or decrypted user data here
export const storage = createMMKV({ id: 'budget-buddy' });
