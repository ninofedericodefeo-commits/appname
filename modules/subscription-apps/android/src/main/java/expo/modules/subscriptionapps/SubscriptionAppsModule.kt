package expo.modules.subscriptionapps

import android.content.Intent
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SubscriptionAppsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SubscriptionApps")
    AsyncFunction("getLaunchableApps") {
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      val manager = context.packageManager
      val query = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      @Suppress("DEPRECATION")
      manager.queryIntentActivities(query, 0)
        .filter { it.activityInfo.exported && it.activityInfo.enabled && it.activityInfo.packageName != context.packageName }
        .distinctBy { it.activityInfo.packageName }
        .map { mapOf("name" to it.loadLabel(manager).toString(), "packageName" to it.activityInfo.packageName) }
    }
    AsyncFunction("openPackage") { packageName: String ->
      require(Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+").matches(packageName)) { "Invalid app package" }
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      val launch = context.packageManager.getLaunchIntentForPackage(packageName)
        ?: throw IllegalArgumentException("App is no longer installed")
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(launch)
      true
    }
    Function("getQuerySchemes") {
      val context = appContext.reactContext ?: return@Function emptyList<String>()
      @Suppress("DEPRECATION")
      val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      info.metaData?.getString("gasfinder.subscriptionAppSchemes")?.split(",") ?: emptyList<String>()
    }
  }
}
