import ExpoModulesCore

/// Errors with the `ERR_WALLET_*` codes documented in `ExpoWallet.types.ts`.
enum WalletException {
  static func unavailable(_ message: String) -> Exception {
    make("ERR_WALLET_UNAVAILABLE", message)
  }

  static func invalidPass(_ message: String) -> Exception {
    make("ERR_WALLET_INVALID_PASS", message)
  }

  static func loadFailed(_ message: String) -> Exception {
    make("ERR_WALLET_LOAD_FAILED", message)
  }

  static func busy() -> Exception {
    make("ERR_WALLET_BUSY", "Another add-pass flow is already on screen.")
  }

  static func presentationFailed() -> Exception {
    make("ERR_WALLET_PRESENTATION_FAILED", "There is no view controller to present Apple Wallet from.")
  }

  static func passNotFound(_ passTypeIdentifier: String, _ serialNumber: String) -> Exception {
    make(
      "ERR_WALLET_PASS_NOT_FOUND",
      "Pass \(passTypeIdentifier)/\(serialNumber) isn't in Wallet, or the app lacks the "
        + "com.apple.developer.pass-type-identifiers entitlement for it."
    )
  }

  private static func make(_ code: String, _ message: String) -> Exception {
    Exception(name: "WalletException", description: message, code: code)
  }
}
