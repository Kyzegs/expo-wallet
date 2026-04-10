import { registerWebModule, NativeModule } from 'expo';

import type { ExpoWalletNativeModule } from './ExpoWallet.types';

class ExpoWalletModuleWeb extends NativeModule implements ExpoWalletNativeModule {
  async canAddPass(): Promise<boolean> {
    return false;
  }

  async hasPass(_passTypeIdentifier: string, _serialNumber: string): Promise<boolean> {
    return false;
  }

  async addPass(_payload: Array<Record<string, string>> | string): Promise<boolean> {
    throw new Error('expo-wallet: Wallet APIs are not available on web.');
  }
}

export default registerWebModule(ExpoWalletModuleWeb, 'ExpoWallet');
