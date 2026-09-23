package expo.modules.wallet

import android.app.Activity
import com.google.android.gms.pay.Pay
import com.google.android.gms.pay.PayApiAvailabilityStatus
import com.google.android.gms.pay.PayClient
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoWalletModule : Module() {
  private var pendingSave: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoWallet")

    AsyncFunction("canAddPasses") { promise: Promise ->
      // JWT saves are the common case; fall back to the JSON API's availability.
      isAvailable(PayClient.RequestType.SAVE_PASSES_JWT) { jwtAvailable ->
        if (jwtAvailable) {
          promise.resolve(true)
        } else {
          isAvailable(PayClient.RequestType.SAVE_PASSES) { promise.resolve(it) }
        }
      }
    }

    AsyncFunction("savePassesJwt") { jwt: String, promise: Promise ->
      save(promise) { client, activity -> client.savePassesJwt(jwt, activity, SAVE_PASSES_REQUEST_CODE) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("savePasses") { json: String, promise: Promise ->
      save(promise) { client, activity -> client.savePasses(json, activity, SAVE_PASSES_REQUEST_CODE) }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != SAVE_PASSES_REQUEST_CODE) {
        return@OnActivityResult
      }
      val promise = pendingSave ?: return@OnActivityResult
      pendingSave = null

      when (payload.resultCode) {
        Activity.RESULT_OK -> promise.resolve("added")
        Activity.RESULT_CANCELED -> promise.resolve("cancelled")
        PayClient.SavePassesResult.SAVE_ERROR -> promise.reject(
          WalletException(
            "ERR_WALLET_SAVE_FAILED",
            payload.data?.getStringExtra(PayClient.EXTRA_API_ERROR_MESSAGE)
              ?: "Google Wallet couldn't save the pass. Check the JWT or JSON and your issuer setup."
          )
        )
        PayClient.SavePassesResult.API_UNAVAILABLE -> promise.reject(
          WalletException("ERR_WALLET_UNAVAILABLE", "Google Wallet isn't available on this device.")
        )
        else -> promise.reject(
          WalletException(
            "ERR_WALLET_INTERNAL",
            "Google Wallet failed with result code ${payload.resultCode}. Try again later."
          )
        )
      }
    }
  }

  private fun isAvailable(requestType: Int, callback: (Boolean) -> Unit) {
    val context = appContext.reactContext ?: return callback(false)
    Pay.getClient(context)
      .getPayApiAvailabilityStatus(requestType)
      .addOnSuccessListener { status -> callback(status == PayApiAvailabilityStatus.AVAILABLE) }
      .addOnFailureListener { callback(false) }
  }

  private fun save(promise: Promise, launch: (PayClient, Activity) -> Unit) {
    if (pendingSave != null) {
      promise.reject(WalletException("ERR_WALLET_BUSY", "Another add-pass flow is already on screen."))
      return
    }
    val activity = appContext.currentActivity ?: run {
      promise.reject(WalletException("ERR_WALLET_PRESENTATION_FAILED", "There is no Activity to launch Google Wallet from."))
      return
    }
    pendingSave = promise
    try {
      launch(Pay.getClient(activity), activity)
    } catch (e: Exception) {
      pendingSave = null
      promise.reject(WalletException("ERR_WALLET_INTERNAL", "Couldn't launch Google Wallet: ${e.message}", e))
    }
  }

  companion object {
    private const val SAVE_PASSES_REQUEST_CODE = 0x6577 // "ew"
  }
}

/** Errors with the `ERR_WALLET_*` codes documented in `ExpoWallet.types.ts`. */
internal class WalletException(code: String, message: String, cause: Throwable? = null) :
  CodedException(code, message, cause)
