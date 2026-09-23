import { requireNativeView } from 'expo';
import { StyleSheet } from 'react-native';

import type { AppleWalletButtonProps } from './ExpoWallet.types';
import ExpoWalletModule from './ExpoWalletModule';

// The inner `PKAddPassButton` is a `UIButton` with its own localized accessibility label.
const NativeAppleWalletButton =
  ExpoWalletModule != null ? requireNativeView<AppleWalletButtonProps>('ExpoWallet') : null;

/**
 * The official "Add to Apple Wallet" button (`PKAddPassButton`), localized by the system.
 * Renders nothing on other platforms. For Android, use Google's
 * [Add to Google Wallet button assets](https://developers.google.com/wallet/generic/resources/brand-guidelines).
 *
 * @platform ios
 */
export default function AppleWalletButton({
  buttonStyle = 'black',
  disabled = false,
  style,
  ...props
}: AppleWalletButtonProps) {
  if (NativeAppleWalletButton == null) {
    return null;
  }
  return (
    <NativeAppleWalletButton
      {...props}
      buttonStyle={buttonStyle}
      disabled={disabled}
      style={[styles.button, style]}
    />
  );
}

const styles = StyleSheet.create({
  // Native views have no intrinsic size in React Native. Give the button Apple's usual size
  // so it's visible without a style.
  button: { height: 48, minWidth: 160 },
});
