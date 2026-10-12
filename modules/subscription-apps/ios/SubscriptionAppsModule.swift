import ExpoModulesCore
import Foundation

public class SubscriptionAppsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SubscriptionApps")
    Function("getQuerySchemes") {
      return Bundle.main.object(forInfoDictionaryKey: "LSApplicationQueriesSchemes") as? [String] ?? []
    }
  }
}
