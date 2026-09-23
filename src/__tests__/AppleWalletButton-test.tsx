import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AppleWalletButton } from '..';

jest.mock('../ExpoWalletModule', () => ({ __esModule: true, default: {} }));

if (Platform.OS === 'ios') {
  describe('iOS', () => {
    it("renders Apple's native button with default props", async () => {
      await render(<AppleWalletButton testID="wallet-button" />);
      const button = screen.getByTestId('wallet-button');
      expect(button.props.buttonStyle).toBe('black');
      expect(button.props.disabled).toBe(false);
      // Visible without a style, because native views have no intrinsic size.
      expect(button).toHaveStyle({ height: 48, minWidth: 160 });
    });

    it('passes props through and lets styles override the default size', async () => {
      await render(
        <AppleWalletButton
          testID="wallet-button"
          buttonStyle="blackOutline"
          disabled
          style={{ height: 60 }}
        />
      );
      const button = screen.getByTestId('wallet-button');
      expect(button.props.buttonStyle).toBe('blackOutline');
      expect(button.props.disabled).toBe(true);
      expect(button).toHaveStyle({ height: 60, minWidth: 160 });
    });

    it('calls onPress', async () => {
      const onPress = jest.fn();
      await render(<AppleWalletButton testID="wallet-button" onPress={onPress} />);
      await fireEvent(screen.getByTestId('wallet-button'), 'press');
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
} else {
  it(`renders nothing on ${Platform.OS}`, async () => {
    await render(<AppleWalletButton testID="wallet-button" />);
    expect(screen.queryByTestId('wallet-button')).toBeNull();
  });
}
