import Foundation

// Blocking and settings live entirely in the Safari extension. No native
// messaging, App Group, bank records or browsing history is required.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
  func beginRequest(with context: NSExtensionContext) {
    context.completeRequest(returningItems: [], completionHandler: nil)
  }
}
