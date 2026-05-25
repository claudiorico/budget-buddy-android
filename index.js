// Must run before any crypto operations — patches global.crypto and global.Buffer
import { install } from 'react-native-quick-crypto';
install();

import 'expo-router/entry';
