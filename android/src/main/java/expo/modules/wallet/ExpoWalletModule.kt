package expo.modules.wallet

import android.app.Activity
import com.google.android.gms.pay.Pay
import com.google.android.gms.pay.PayApiAvailabilityStatus
import com.google.android.gms.pay.PayClient
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class ExpoWalletModule : Module() {
  private var pendingSavePassesPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoWallet")

    AsyncFunction("canAddPass") { promise: Promise ->
      val context = appContext.reactContext
        ?: run {
          promise.resolve(false)
          return@AsyncFunction
        }
      val payClient = Pay.getClient(context)
      payClient
        .getPayApiAvailabilityStatus(PayClient.RequestType.SAVE_PASSES)
        .addOnSuccessListener { status: Int ->
          promise.resolve(status == PayApiAvailabilityStatus.AVAILABLE)
        }
        .addOnFailureListener { promise.resolve(false) }
    }

    AsyncFunction("hasPass") { _: String, _: String ->
      throw CodedException(
        "ERR_UNSUPPORTED_CLIENT_SIDE",
        "Google Wallet does not support checking pass existence from the Android client. Use the Google Wallet REST API from your backend.",
        null
      )
    }

    AsyncFunction("addPass") { jwt: String, promise: Promise ->
      if (jwt.isBlank()) {
        promise.reject(
          CodedException(
            "ERR_INVALID_JWT",
            "addPass requires a non-empty JWT string.",
            null
          )
        )
        return@AsyncFunction
      }

      val activity = appContext.currentActivity
        ?: run {
          promise.reject(
            CodedException(
              "ERR_NO_ACTIVITY",
              "No Activity available to launch Google Wallet.",
              null
            )
          )
          return@AsyncFunction
        }

      if (pendingSavePassesPromise != null) {
        promise.reject(
          CodedException(
            "ERR_ADD_PASS_IN_PROGRESS",
            "Another addPass flow is already in progress.",
            null
          )
        )
        return@AsyncFunction
      }

      pendingSavePassesPromise = promise
      val reactContext = appContext.reactContext
        ?: run {
          pendingSavePassesPromise = null
          promise.reject(CodedException("ERR_NO_CONTEXT", "React context lost.", null))
          return@AsyncFunction
        }
      val payClient = Pay.getClient(reactContext)
      payClient.savePassesJwt(jwt, activity, SAVE_PASSES_REQUEST_CODE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != SAVE_PASSES_REQUEST_CODE) {
        return@OnActivityResult
      }

      val promise = pendingSavePassesPromise ?: return@OnActivityResult
      pendingSavePassesPromise = null

      when (payload.resultCode) {
        Activity.RESULT_OK -> promise.resolve(true)
        Activity.RESULT_CANCELED -> promise.resolve(false)
        PayClient.SavePassesResult.SAVE_ERROR -> {
          val message =
            payload.data?.getStringExtra(PayClient.EXTRA_API_ERROR_MESSAGE)
              ?: "Google Wallet reported SAVE_ERROR."
          promise.reject(
            CodedException(
              "ERR_WALLET_SAVE_ERROR",
              message,
              null
            )
          )
        }
        PayClient.SavePassesResult.API_UNAVAILABLE -> {
          promise.reject(
            CodedException(
              "ERR_WALLET_API_UNAVAILABLE",
              "Google Wallet save API is unavailable on this device.",
              null
            )
          )
        }
        PayClient.SavePassesResult.INTERNAL_ERROR -> {
          promise.reject(
            CodedException(
              "ERR_WALLET_INTERNAL",
              "Google Wallet reported an internal error. Try again later.",
              null
            )
          )
        }
        else -> {
          promise.reject(
            CodedException(
              "ERR_WALLET_UNKNOWN_RESULT",
              "Unexpected result code: ${payload.resultCode}",
              null
            )
          )
        }
      }
    }
  }

  companion object {
    private const val SAVE_PASSES_REQUEST_CODE = 0x6578_7077 // "expw"
  }
}
