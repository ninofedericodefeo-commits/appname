import AppIntents
import PurchaseInbox

/// Compiled in the application target so Xcode extracts this action's metadata.
struct QueueWalletPurchaseIntent: AppIntent {
  static var title: LocalizedStringResource = "Queue purchase for review"
  static var description = IntentDescription("Save a purchase for review in GasFinder without opening the app. This does not change balances or savings.")
  static var openAppWhenRun: Bool = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

  @Parameter(title: "Merchant") var merchant: String
  @Parameter(title: "Amount") var amount: Double
  @Parameter(title: "Currency", default: "USD") var currency: String
  @Parameter(title: "Transaction ID") var transactionID: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Queue \(\.$amount) purchase at \(\.$merchant)")
  }

  func perform() async throws -> some IntentResult {
    try PurchaseInboxQueue.capture(merchant: merchant, amount: amount, currency: currency, transactionID: transactionID)
    return .result()
  }
}
