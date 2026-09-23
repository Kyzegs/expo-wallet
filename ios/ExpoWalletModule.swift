import ExpoModulesCore
import PassKit
import UIKit

// `PKPassLibrary` isn't thread-safe, so every call makes its own instance on the thread it runs on.
public final class ExpoWalletModule: Module {
  private var addPassesFlow: AddPassesFlow?
  private var libraryObserver: NSObjectProtocol?
  // PassKit only posts change notifications while a `PKPassLibrary` exists. Never called, only kept alive.
  private var observedLibrary: PKPassLibrary?

  public func definition() -> ModuleDefinition {
    Name("ExpoWallet")

    Events("onPassLibraryChange")

    OnStartObserving("onPassLibraryChange") {
      self.startObservingLibrary()
    }

    OnStopObserving("onPassLibraryChange") {
      self.stopObservingLibrary()
    }

    OnDestroy {
      self.stopObservingLibrary()
    }

    AsyncFunction("canAddPasses") { () -> Bool in
      PKPassLibrary.isPassLibraryAvailable() && PKAddPassesViewController.canAddPasses()
    }

    AsyncFunction("addPasses") { (sources: [PassSource], blobs: [Data], presentation: ApplePresentation) async throws -> String in
      let passes = try await PassLoader.load(sources, blobs: blobs)
      return try await withCheckedThrowingContinuation { continuation in
        Task { @MainActor in
          self.presentAddPasses(passes, presentation) { result in
            continuation.resume(with: result)
          }
        }
      }
    }

    AsyncFunction("replacePass") { (source: PassSource, blobs: [Data]) async throws -> Bool in
      let passes = try await PassLoader.load([source], blobs: blobs)
      return PKPassLibrary().replacePass(with: passes[0])
    }

    // Unlike the lookups by identifier, this works without the pass-type-identifiers entitlement.
    AsyncFunction("containsPass") { (source: PassSource, blobs: [Data]) async throws -> Bool in
      let passes = try await PassLoader.load([source], blobs: blobs)
      return PKPassLibrary().containsPass(passes[0])
    }

    AsyncFunction("getPasses") { () -> [[String: Any]] in
      PKPassLibrary().passes().map(serialize)
    }

    AsyncFunction("getPass") { (passTypeIdentifier: String, serialNumber: String) -> [String: Any]? in
      PKPassLibrary().pass(withPassTypeIdentifier: passTypeIdentifier, serialNumber: serialNumber).map(serialize)
    }

    AsyncFunction("removePass") { (passTypeIdentifier: String, serialNumber: String) throws in
      let library = PKPassLibrary()
      guard let pass = library.pass(withPassTypeIdentifier: passTypeIdentifier, serialNumber: serialNumber) else {
        throw WalletException.passNotFound(passTypeIdentifier, serialNumber)
      }
      library.removePass(pass)
    }

    AsyncFunction("openPass") { (passTypeIdentifier: String, serialNumber: String) async throws in
      guard let url = PKPassLibrary().pass(withPassTypeIdentifier: passTypeIdentifier, serialNumber: serialNumber)?.passURL else {
        throw WalletException.passNotFound(passTypeIdentifier, serialNumber)
      }
      guard await UIApplication.shared.open(url) else {
        throw WalletException.unavailable("Couldn't open the Wallet app.")
      }
    }

    View(AppleWalletButtonView.self) {
      Events("onPress")

      Prop("buttonStyle") { (view: AppleWalletButtonView, style: AppleWalletButtonStyle) in
        view.setButtonStyle(style)
      }

      Prop("disabled") { (view: AppleWalletButtonView, disabled: Bool) in
        view.setDisabled(disabled)
      }
    }
  }

  // MARK: - Adding passes

  @MainActor
  private func presentAddPasses(
    _ passes: [PKPass],
    _ presentation: ApplePresentation,
    completion: @escaping (Result<String, Error>) -> Void
  ) {
    if let activeFlow = addPassesFlow {
      guard !activeFlow.isPresenting else {
        completion(.failure(WalletException.busy()))
        return
      }
      // The previous sheet went away without telling us. Settle it before starting over.
      activeFlow.finishWithLibraryState()
    }
    guard let presenter = appContext?.utilities?.currentViewController() else {
      completion(.failure(WalletException.presentationFailed()))
      return
    }

    let flow = AddPassesFlow(passes: passes) { [weak self] result in
      self?.addPassesFlow = nil
      completion(result)
    }
    addPassesFlow = flow
    flow.start(presentation, from: presenter)
  }

  // MARK: - Pass library changes

  private func startObservingLibrary() {
    guard libraryObserver == nil else {
      return
    }
    observedLibrary = PKPassLibrary()
    let name = Notification.Name(PKPassLibraryNotificationName.PKPassLibraryDidChange.rawValue)
    libraryObserver = NotificationCenter.default.addObserver(forName: name, object: nil, queue: nil) { [weak self] notification in
      self?.sendLibraryChange(notification.userInfo ?? [:])
    }
  }

  private func stopObservingLibrary() {
    if let libraryObserver {
      NotificationCenter.default.removeObserver(libraryObserver)
    }
    libraryObserver = nil
    observedLibrary = nil
  }

  private func sendLibraryChange(_ userInfo: [AnyHashable: Any]) {
    // The keys are NSStrings, so look them up by raw value.
    let added = userInfo[PKPassLibraryNotificationKey.addedPassesUserInfoKey.rawValue] as? [PKPass] ?? []
    let replaced = userInfo[PKPassLibraryNotificationKey.replacementPassesUserInfoKey.rawValue] as? [PKPass] ?? []
    let removed = userInfo[PKPassLibraryNotificationKey.removedPassInfosUserInfoKey.rawValue] as? [[AnyHashable: Any]] ?? []

    sendEvent("onPassLibraryChange", [
      "added": added.map(serialize),
      "replaced": replaced.map(serialize),
      "removed": removed.map { info in
        [
          "passTypeIdentifier": info[PKPassLibraryNotificationKey.passTypeIdentifierUserInfoKey.rawValue] as? String ?? "",
          "serialNumber": info[PKPassLibraryNotificationKey.serialNumberUserInfoKey.rawValue] as? String ?? ""
        ]
      }
    ])
  }
}

/// The `Pass` shape from `ExpoWallet.types.ts`.
private func serialize(_ pass: PKPass) -> [String: Any] {
  var result: [String: Any] = [
    "passTypeIdentifier": pass.passTypeIdentifier,
    "serialNumber": pass.serialNumber,
    "organizationName": pass.organizationName,
    "localizedName": pass.localizedName,
    "localizedDescription": pass.localizedDescription,
    "deviceName": pass.deviceName,
    "isRemotePass": pass.isRemotePass
  ]
  result["passURL"] = pass.passURL?.absoluteString
  result["webServiceURL"] = pass.webServiceURL?.absoluteString
  result["authenticationToken"] = pass.authenticationToken
  result["userInfo"] = pass.userInfo as? [String: Any]
  return result
}
