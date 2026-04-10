import ExpoModulesCore
import PassKit
import UIKit

private final class AddPassesFlow: NSObject, PKAddPassesViewControllerDelegate {
  private let passes: [PKPass]
  private let promise: Promise
  private let onReleased: () -> Void

  init(passes: [PKPass], promise: Promise, onReleased: @escaping () -> Void) {
    self.passes = passes
    self.promise = promise
    self.onReleased = onReleased
    super.init()
  }

  func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) {
    let library = PKPassLibrary()
    let allSaved = passes.allSatisfy { library.containsPass($0) }

    controller.dismiss(animated: true) { [weak self] in
      guard let self else { return }
      self.promise.resolve(allSaved)
      self.onReleased()
    }
  }
}

public class ExpoWalletModule: Module {
  private var activeAddPassesFlow: AddPassesFlow?

  public func definition() -> ModuleDefinition {
    Name("ExpoWallet")

    AsyncFunction("canAddPass") { () -> Bool in
      PKAddPassesViewController.canAddPasses()
    }

    AsyncFunction("hasPass") { (passTypeIdentifier: String, serialNumber: String) -> Bool in
      // Requires com.apple.developer.pass-type-identifiers entitlement for passes your app did not issue.
      let library = PKPassLibrary()
      return library.pass(withPassTypeIdentifier: passTypeIdentifier, serialNumber: serialNumber) != nil
    }

    AsyncFunction("addPass") { (passData: [[String: Any]], promise: Promise) in
      var pkPasses: [PKPass] = []
      var errors: [String] = []

      for (index, raw) in passData.enumerated() {
        let base64 = raw["base64"] as? String
        let localUri = raw["localUri"] as? String

        var data: Data?

        if let base64, !base64.isEmpty {
          data = Data(base64Encoded: base64, options: [.ignoreUnknownCharacters])
          if data == nil {
            errors.append("Pass at index \(index): invalid base64 data.")
          }
        } else if let localUri, !localUri.isEmpty {
          guard let url = URL(string: localUri) else {
            errors.append("Pass at index \(index): invalid localUri.")
            continue
          }
          do {
            data = try Data(contentsOf: url)
          } catch {
            errors.append("Pass at index \(index): could not read file (\(error.localizedDescription)).")
          }
        } else {
          errors.append("Pass at index \(index): missing both base64 and localUri.")
        }

        guard let passData = data else {
          continue
        }

        do {
          let pass = try PKPass(data: passData)
          pkPasses.append(pass)
        } catch {
          errors.append("Pass at index \(index): invalid pkpass (\(error.localizedDescription)).")
        }
      }

      guard !pkPasses.isEmpty else {
        let detail = errors.isEmpty ? "No pass data provided." : errors.joined(separator: " ")
        promise.reject(Exception(name: "ERR_NO_VALID_PASSES", description: detail, code: "ERR_NO_VALID_PASSES"))
        return
      }

      if !errors.isEmpty {
        NSLog("expo-wallet: Some passes failed to parse and were skipped: %@", errors.joined(separator: " | "))
      }

      DispatchQueue.main.async { [weak self] in
        guard let self else {
          promise.reject(Exception(name: "ERR_MODULE_RELEASED", description: "ExpoWalletModule was released.", code: "ERR_MODULE_RELEASED"))
          return
        }

        guard let utilities = self.appContext?.utilities,
              let viewController = utilities.currentViewController() else {
          promise.reject(Exception(name: "ERR_NO_VIEW_CONTROLLER", description: "No UIViewController available to present Wallet UI.", code: "ERR_NO_VIEW_CONTROLLER"))
          return
        }

        let flow = AddPassesFlow(passes: pkPasses, promise: promise) { [weak self] in
          self?.activeAddPassesFlow = nil
        }
        self.activeAddPassesFlow = flow

        let addController: PKAddPassesViewController?
        if pkPasses.count == 1 {
          addController = PKAddPassesViewController(pass: pkPasses[0])
        } else {
          addController = PKAddPassesViewController(passes: pkPasses)
        }

        guard let addController else {
          self.activeAddPassesFlow = nil
          promise.reject(Exception(name: "ERR_CANNOT_CREATE_ADD_UI", description: "Could not create PKAddPassesViewController.", code: "ERR_CANNOT_CREATE_ADD_UI"))
          return
        }

        addController.delegate = flow
        viewController.present(addController, animated: true, completion: nil)
      }
    }
  }
}
