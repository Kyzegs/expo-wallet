import { requireNativeModule } from 'expo-modules-core';

import type { ExpoWalletNativeModule } from './ExpoWallet.types';

export default requireNativeModule<ExpoWalletNativeModule>('ExpoWallet');
