import ExpoModulesCore

public class PurchaseInboxModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PurchaseInbox")
    Function("getVersion") { 1 }
    AsyncFunction("listPending") { try PurchaseInboxQueue.listPending() }
    AsyncFunction("removePending") { (id: String) in try PurchaseInboxQueue.removePending(id: id) }
    AsyncFunction("clearPending") { try PurchaseInboxQueue.clearPending() }
  }
}
