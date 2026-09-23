import ExpoModulesCore
import PassKit
import UIKit

enum ApplePresentation: String, Enumerable {
  case sheet
  case alert
}

/// Shows the Apple Wallet UI for one `addPass` call and reports `"added"` or `"cancelled"` once.
@MainActor
// PassKit's delegate protocol isn't annotated for concurrency, but PassKit calls it on the main thread.
final class AddPassesFlow: NSObject, @preconcurrency PKAddPassesViewControllerDelegate, UIAdaptivePresentationControllerDelegate {
  private let passes: [PKPass]
  // Created and used on the main thread only; `PKPassLibrary` isn't thread-safe.
  private let library = PKPassLibrary()
  private var completion: ((Result<String, Error>) -> Void)?
  private weak var sheet: PKAddPassesViewController?
  private var isShowingAlert = false

  init(passes: [PKPass], completion: @escaping (Result<String, Error>) -> Void) {
    self.passes = passes
    self.completion = completion
    super.init()
  }

  /// Whether the flow still has UI on screen. Used to recover if the sheet disappeared without a callback.
  var isPresenting: Bool {
    isShowingAlert || sheet?.presentingViewController != nil
  }

  func start(_ presentation: ApplePresentation, from presenter: UIViewController) {
    switch presentation {
    case .sheet:
      presentSheet(from: presenter)
    case .alert:
      // Apple's compact "Add All / Review" alert. Only "Review" needs the sheet.
      isShowingAlert = true
      library.addPasses(passes) { status in
        Task { @MainActor in
          self.isShowingAlert = false
          switch status {
          case .didAddPasses:
            self.finish(.success("added"))
          case .shouldReviewPasses:
            self.presentSheet(from: presenter)
          case .didCancelAddPasses:
            self.finish(.success("cancelled"))
          @unknown default:
            self.finishWithLibraryState()
          }
        }
      }
    }
  }

  func finishWithLibraryState() {
    // If every pass is in the library, it was added (or was already there).
    // `containsPass` works without the pass-type-identifiers entitlement.
    let added = passes.allSatisfy { library.containsPass($0) }
    finish(.success(added ? "added" : "cancelled"))
  }

  private func presentSheet(from presenter: UIViewController) {
    let controller: PKAddPassesViewController? = PKAddPassesViewController(passes: passes)
    guard let controller else {
      finish(.failure(WalletException.unavailable("This device can't add passes to Apple Wallet.")))
      return
    }
    controller.delegate = self
    controller.presentationController?.delegate = self
    sheet = controller
    presenter.present(controller, animated: true)
  }

  private func finish(_ result: Result<String, Error>) {
    guard let completion else {
      return
    }
    self.completion = nil
    completion(result)
  }

  // MARK: - PKAddPassesViewControllerDelegate

  func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) {
    controller.dismiss(animated: true) {
      self.finishWithLibraryState()
    }
  }

  // MARK: - UIAdaptivePresentationControllerDelegate

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    // The user swiped the sheet away.
    finishWithLibraryState()
  }
}
