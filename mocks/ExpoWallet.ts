/**
 * Mock of the ExpoWallet native module. jest-expo loads it automatically in apps' tests, so
 * `@kyzegs/expo-wallet` works in Jest without manual mocks. Each function is wrapped in `jest.fn()`
 * and models the happy path: the wallet is available and the user adds the pass.
 */
import type { AddPassResult, ApplePresentation, Pass } from '../src/ExpoWallet.types';
import type { NativeApplePassSource } from '../src/ExpoWalletModule';

export async function canAddPasses(): Promise<boolean> {
  return true;
}

export async function addPasses(
  sources: NativeApplePassSource[],
  blobs: Uint8Array[],
  presentation: ApplePresentation
): Promise<AddPassResult> {
  return 'added';
}

export async function replacePass(
  source: NativeApplePassSource,
  blobs: Uint8Array[]
): Promise<boolean> {
  return true;
}

export async function containsPass(
  source: NativeApplePassSource,
  blobs: Uint8Array[]
): Promise<boolean> {
  return false;
}

export async function getPasses(): Promise<Pass[]> {
  return [];
}

export async function getPass(
  passTypeIdentifier: string,
  serialNumber: string
): Promise<Pass | null> {
  return null;
}

export async function removePass(passTypeIdentifier: string, serialNumber: string): Promise<void> {}

export async function openPass(passTypeIdentifier: string, serialNumber: string): Promise<void> {}

export async function savePassesJwt(jwt: string): Promise<AddPassResult> {
  return 'added';
}

export async function savePasses(json: string): Promise<AddPassResult> {
  return 'added';
}
