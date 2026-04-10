export interface PassSource {
  /** A local file URI (file://...) pointing to a downloaded .pkpass file */
  localUri?: string;
  /** Alternatively, a base64 encoded string of the .pkpass file */
  base64?: string;
}

export interface AddPassOptions {
  ios?: {
    /** A single pass to add */
    pass?: PassSource;
    /** Array of passes to add simultaneously */
    passes?: PassSource[];
  };
  android?: {
    /** Google Wallet API JWT string (can contain one or multiple passes) */
    jwt: string;
  };
}

export interface HasPassOptions {
  ios?: {
    passTypeIdentifier: string;
    serialNumber: string;
  };
  android?: {
    /**
     * Note: Android cannot check passes natively on the client.
     * You must query the Google Wallet REST API from your backend.
     * Passing data here is a placeholder for your own logic if needed.
     */
    objectId?: string;
  };
}

/** Native module shape (methods differ slightly per platform). */
export interface ExpoWalletNativeModule {
  canAddPass(): Promise<boolean>;
  /** iOS only — not invoked from JS on Android. */
  hasPass(passTypeIdentifier: string, serialNumber: string): Promise<boolean>;
  /**
   * iOS: array of `{ localUri?, base64? }` records.
   * Android: JWT string.
   */
  addPass(
    payload: Array<Record<string, string>> | string
  ): Promise<boolean>;
}

/** @alias {@link ExpoWalletNativeModule} */
export type ExpoWalletModule = ExpoWalletNativeModule;
