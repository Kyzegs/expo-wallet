import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  AddPassResult,
  ApplePresentation,
  Pass,
  PassLibraryChangeEvent,
} from './ExpoWallet.types';

/** Apple pass source as sent to native. `dataIndex` points into the `blobs` argument. */
export interface NativeApplePassSource {
  uri?: string;
  headers?: Record<string, string>;
  base64?: string;
  dataIndex?: number;
}

type ExpoWalletEvents = {
  onPassLibraryChange(event: PassLibraryChangeEvent): void;
};

/**
 * The native module. Functions exist only on the platform that implements them;
 * `index.ts` checks the platform before calling them.
 */
export declare class ExpoWalletNativeModule extends NativeModule<ExpoWalletEvents> {
  canAddPasses(): Promise<boolean>;

  // iOS
  addPasses(
    sources: NativeApplePassSource[],
    blobs: Uint8Array[],
    presentation: ApplePresentation
  ): Promise<AddPassResult>;
  replacePass(source: NativeApplePassSource, blobs: Uint8Array[]): Promise<boolean>;
  containsPass(source: NativeApplePassSource, blobs: Uint8Array[]): Promise<boolean>;
  getPasses(): Promise<Pass[]>;
  getPass(passTypeIdentifier: string, serialNumber: string): Promise<Pass | null>;
  removePass(passTypeIdentifier: string, serialNumber: string): Promise<void>;
  openPass(passTypeIdentifier: string, serialNumber: string): Promise<void>;

  // Android
  savePassesJwt(jwt: string): Promise<AddPassResult>;
  savePasses(json: string): Promise<AddPassResult>;
}

/** `null` when the app was built without this module, e.g. in Expo Go. */
export default requireOptionalNativeModule<ExpoWalletNativeModule>('ExpoWallet');
