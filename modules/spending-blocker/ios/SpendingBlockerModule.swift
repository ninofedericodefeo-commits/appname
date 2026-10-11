import ExpoModulesCore
import SafariServices

public class SpendingBlockerModule: Module {
  private var identifier: String { (Bundle.main.bundleIdentifier ?? "com.anonymous.gasfinder") + ".spendingpause" }
  private var bundled: Bool {
    guard let directory = Bundle.main.builtInPlugInsURL,
      let extensions = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return false }
    return extensions.contains { Bundle(url: $0)?.bundleIdentifier == identifier }
  }

  public func definition() -> ModuleDefinition {
    Name("SpendingBlocker")

    AsyncFunction("getStatus") { (promise: Promise) in
      guard self.bundled else {
        promise.resolve(["bundled": false, "enabled": NSNull(), "settingsSupported": false] as [String: Any]); return
      }
      if #available(iOS 26.2, *) {
        SFSafariExtensionManager.getStateOfExtension(withIdentifier: self.identifier) { state, _ in
          promise.resolve(["bundled": true, "enabled": state.map { $0.isEnabled as Any } ?? NSNull(), "settingsSupported": true] as [String: Any])
        }
      } else {
        promise.resolve(["bundled": true, "enabled": NSNull(), "settingsSupported": false] as [String: Any])
      }
    }.runOnQueue(.main)

    AsyncFunction("openSettings") { (promise: Promise) in
      guard self.bundled else { promise.reject("MISSING_EXTENSION", "Update the iPhone app to include Spending Pause."); return }
      if #available(iOS 26.2, *) {
        SFSafariSettings.openExtensionsSettings(forIdentifiers: [self.identifier]) { error in
          if error != nil { promise.reject("SETTINGS_UNAVAILABLE", "Open Settings → Apps → Safari → Extensions → GasFinder Spending Pause.") }
          else { promise.resolve() }
        }
      } else {
        promise.reject("SETTINGS_UNAVAILABLE", "Open Settings → Apps → Safari → Extensions → GasFinder Spending Pause.")
      }
    }.runOnQueue(.main)
  }
}
