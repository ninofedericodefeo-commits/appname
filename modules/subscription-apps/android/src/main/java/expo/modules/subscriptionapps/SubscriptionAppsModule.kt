package expo.modules.subscriptionapps

import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SubscriptionAppsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SubscriptionApps")
    Function("getQuerySchemes") {
      val context = appContext.reactContext ?: return@Function emptyList<String>()
      @Suppress("DEPRECATION")
      val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      info.metaData?.getString("gasfinder.subscriptionAppSchemes")?.split(",") ?: emptyList<String>()
    }
  }
}
