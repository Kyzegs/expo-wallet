import type { AppleWalletButtonProps } from './ExpoWallet.types';

/**
 * The official "Add to Apple Wallet" button (`PKAddPassButton`), localized by the system.
 * Renders nothing on other platforms. For Android, use Google's
 * [Add to Google Wallet button assets](https://developers.google.com/wallet/generic/resources/brand-guidelines).
 *
 * @platform ios
 */
export default function AppleWalletButton(_props: AppleWalletButtonProps) {
  return null;
}
