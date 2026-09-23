import { registerWebModule, NativeModule } from 'expo';

// Browsers have no wallet API. For Google Wallet on the web, link to `getGoogleWalletSaveUrl(jwt)`.
class ExpoWalletModuleWeb extends NativeModule {
  async canAddPasses(): Promise<boolean> {
    return false;
  }
}

export default registerWebModule(ExpoWalletModuleWeb, 'ExpoWallet');
