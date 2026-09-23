import ExpoModulesCore
import PassKit

enum AppleWalletButtonStyle: String, Enumerable {
  case black
  case blackOutline

  var pkStyle: PKAddPassButtonStyle {
    switch self {
    case .black:
      return .black
    case .blackOutline:
      return .blackOutline
    }
  }
}

/// Wraps `PKAddPassButton`, the system's localized "Add to Apple Wallet" button.
final class AppleWalletButtonView: ExpoView {
  let onPress = EventDispatcher()
  private let button = PKAddPassButton(addPassButtonStyle: .black)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    button.addTarget(self, action: #selector(handlePress), for: .touchUpInside)
    addSubview(button)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  func setButtonStyle(_ style: AppleWalletButtonStyle) {
    button.addPassButtonStyle = style.pkStyle
  }

  func setDisabled(_ disabled: Bool) {
    button.isEnabled = !disabled
  }

  @objc private func handlePress() {
    onPress()
  }
}
