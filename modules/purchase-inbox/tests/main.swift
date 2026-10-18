import Foundation

func expect(_ condition: Bool, _ message: String) {
  guard condition else { fatalError(message) }
}
func rejects(_ operation: () throws -> Void) {
  do { try operation(); fatalError("Expected rejection") } catch {}
}
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: root) }
let first = try PurchaseInboxQueue.capture(merchant: "  Coffee shop  ", amount: 12.34, transactionID: "wallet-test-id")
expect(first.range(of: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-58][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", options: .regularExpression) != nil, "Stable UUID accepted by JS boundary")
let repeated = try PurchaseInboxQueue.capture(merchant: "Coffee shop", amount: 12.34, transactionID: "wallet-test-id")
expect(first == repeated, "Stable transaction ID is idempotent")
rejects { _ = try PurchaseInboxQueue.capture(merchant: "Other merchant", amount: 12.34, transactionID: "wallet-test-id") }
expect(first[first.index(first.startIndex, offsetBy: 14)] == "8", "SHA-256 IDs use RFC9562 version8")
let boundaryID = try PurchaseInboxQueue.capture(merchant: String(repeating: "A", count: 80), amount: 10)
expect(try PurchaseInboxQueue.removePending(id: boundaryID), "80 UTF16 units accepted")
rejects { _ = try PurchaseInboxQueue.capture(merchant: String(repeating: "😀", count: 41), amount: 10) }
let rows = try PurchaseInboxQueue.listPending()
expect(rows.count == 1, "Repeated capture does not duplicate")
expect(rows[0]["amountCents"] as? Int == 1234, "Exact cents")
expect(rows[0]["merchant"] as? String == "Coffee shop", "Trim merchant")
expect(rows[0]["currency"] as? String == "USD", "USD only")
for amount in [Double.nan, Double.infinity, -1, 0, 0.001, 1.005, 1_000_000.01] {
  rejects { _ = try PurchaseInboxQueue.capture(merchant: "Test", amount: amount) }
}
rejects { _ = try PurchaseInboxQueue.capture(merchant: "Test", amount: 10, currency: "EUR") }
rejects { _ = try PurchaseInboxQueue.capture(merchant: "Test\nInjected", amount: 10) }
rejects { _ = try PurchaseInboxQueue.capture(merchant: String(repeating: "A", count: 81), amount: 10) }
rejects { _ = try PurchaseInboxQueue.removePending(id: "../../outside") }
expect(try PurchaseInboxQueue.removePending(id: first), "Delete pending")
expect(try !PurchaseInboxQueue.removePending(id: first), "Delete idempotently")
DispatchQueue.concurrentPerform(iterations: 25) { index in
  do { try PurchaseInboxQueue.capture(merchant: "Concurrent \(index)", amount: 1.01) }
  catch { fatalError("Concurrent queue write failed: \(error)") }
}
expect(try PurchaseInboxQueue.listPending().count == 25, "Concurrent captures are preserved")
try PurchaseInboxQueue.clearPending()
expect(try PurchaseInboxQueue.listPending().isEmpty, "Erase inbox")
for index in 0..<200 { try PurchaseInboxQueue.capture(merchant: "Purchase \(index)", amount: 10) }
rejects { _ = try PurchaseInboxQueue.capture(merchant: "Overflow", amount: 10) }
expect(try PurchaseInboxQueue.listPending().count == 200, "Overflow never evicts pending purchases")
let pending = try PurchaseInboxQueue.listPending()
let expiredID = pending[0]["id"] as! String
let file = root.appendingPathComponent("PurchaseInbox/\(expiredID).json")
var expired = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as! [String: Any]
expired["capturedAt"] = "2000-01-01T00:00:00Z"
try JSONSerialization.data(withJSONObject: expired).write(to: file)
try PurchaseInboxQueue.capture(merchant: "After expiration", amount: 10)
expect(try PurchaseInboxQueue.listPending().count == 200, "Expired records release capacity")
expect(!FileManager.default.fileExists(atPath: file.path), "Thirty-day retention removes expired drafts")
try PurchaseInboxQueue.clearPending()
print("PurchaseInbox native queue tests passed (validation, idempotency, concurrency, capacity, retention, acknowledgement, erasure).")
