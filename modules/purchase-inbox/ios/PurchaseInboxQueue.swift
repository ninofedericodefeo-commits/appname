import Foundation
import CryptoKit
import Darwin

/// A separate, bounded review inbox. It never accesses the app's financial stores.
public enum PurchaseInboxQueue {
  private struct Draft: Codable {
    let id: String
    let merchant: String
    let amountCents: Int
    let currency: String
    let capturedAt: String
  }
  public enum QueueError: LocalizedError {
    case invalidPurchase, full, unavailable, conflict
    public var errorDescription: String? {
      switch self {
      case .invalidPurchase: return "Enter a merchant and a valid positive US dollar amount."
      case .full: return "The purchase inbox is full. Open GasFinder and review pending purchases first."
      case .unavailable: return "The purchase could not be saved. Unlock your phone once after restarting, then try again."
      case .conflict: return "This transaction ID already belongs to a different purchase."
      }
    }
  }

  private static let maximumCount = 200
  private static let retention: TimeInterval = 30 * 24 * 60 * 60
  private static let formatter = ISO8601DateFormatter()

  /// Used by the main app's AppIntent without starting React Native or opening UI.
  @discardableResult
  public static func capture(merchant: String, amount: Double, currency: String = "USD", transactionID: String? = nil) throws -> String {
    let merchant = merchant.trimmingCharacters(in: .whitespacesAndNewlines)
    let currency = currency.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    guard !merchant.isEmpty, merchant.utf16.count <= 80,
      !merchant.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }),
      amount.isFinite, amount > 0, amount <= 1_000_000, currency == "USD" else { throw QueueError.invalidPurchase }
    let rounded = (amount * 100).rounded()
    guard rounded >= 1, abs(amount * 100 - rounded) < 0.00001 else { throw QueueError.invalidPurchase }
    let id: String
    if let transactionID, !transactionID.isEmpty {
      guard transactionID.utf8.count <= 256,
        !transactionID.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else { throw QueueError.invalidPurchase }
      var hash = Array(SHA256.hash(data: Data(("GasFinderWalletPurchase:" + transactionID).utf8)).prefix(16))
      // RFC 9562 version 8 permits application-defined SHA-256 payloads.
      hash[6] = (hash[6] & 0x0f) | 0x80
      hash[8] = (hash[8] & 0x3f) | 0x80
      id = UUID(uuid: (hash[0], hash[1], hash[2], hash[3], hash[4], hash[5], hash[6], hash[7], hash[8], hash[9], hash[10], hash[11], hash[12], hash[13], hash[14], hash[15])).uuidString.lowercased()
    } else { id = UUID().uuidString.lowercased() }
    return try locked { directory in
      let now = Date()
      try expire(directory: directory, now: now)
      let file = directory.appendingPathComponent(id + ".json")
      if FileManager.default.fileExists(atPath: file.path) {
        let existing = try read(file)
        guard existing.merchant == merchant, existing.amountCents == Int(rounded), existing.currency == currency else { throw QueueError.conflict }
        return existing.id
      }
      guard try files(directory).count < maximumCount else { throw QueueError.full }
      let draft = Draft(id: id, merchant: merchant, amountCents: Int(rounded), currency: currency, capturedAt: formatter.string(from: now))
      let data = try JSONEncoder().encode(draft)
      #if os(iOS)
      try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      #else
      try data.write(to: file, options: .atomic)
      #endif
      try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
      return id
    }
  }

  public static func listPending() throws -> [[String: Any]] {
    try locked { directory in
      try expire(directory: directory, now: Date())
      return try files(directory).compactMap { file -> Draft? in
        guard let draft = try? read(file), draft.id + ".json" == file.lastPathComponent,
          UUID(uuidString: draft.id) != nil, draft.currency == "USD", draft.amountCents > 0,
          draft.amountCents <= 100_000_000, !draft.merchant.isEmpty, draft.merchant.utf16.count <= 80,
          formatter.date(from: draft.capturedAt) != nil else { return nil }
        return draft
      }.sorted { $0.capturedAt < $1.capturedAt }.map {
        ["id": $0.id, "merchant": $0.merchant, "amountCents": $0.amountCents, "currency": $0.currency, "capturedAt": $0.capturedAt]
      }
    }
  }

  @discardableResult
  public static func removePending(id: String) throws -> Bool {
    guard let uuid = UUID(uuidString: id), uuid.uuidString.lowercased() == id else { throw QueueError.invalidPurchase }
    return try locked { directory in
      let file = directory.appendingPathComponent(id + ".json")
      guard FileManager.default.fileExists(atPath: file.path) else { return false }
      try FileManager.default.removeItem(at: file)
      return true
    }
  }

  public static func clearPending() throws {
    try locked { directory in
      for file in try files(directory) { try FileManager.default.removeItem(at: file) }
    }
  }

  private static func read(_ file: URL) throws -> Draft {
    let attributes = try FileManager.default.attributesOfItem(atPath: file.path)
    guard let size = attributes[.size] as? NSNumber, size.intValue <= 4096,
      attributes[.type] as? FileAttributeType == .typeRegular else { throw QueueError.invalidPurchase }
    return try JSONDecoder().decode(Draft.self, from: Data(contentsOf: file))
  }
  private static func files(_ directory: URL) throws -> [URL] {
    try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).filter { $0.pathExtension == "json" }
  }
  private static func expire(directory: URL, now: Date) throws {
    for file in try files(directory) {
      if let draft = try? read(file), let date = formatter.date(from: draft.capturedAt), now.timeIntervalSince(date) > retention {
        try FileManager.default.removeItem(at: file)
      }
    }
  }
  private static func locked<T>(_ operation: (URL) throws -> T) throws -> T {
    let manager = FileManager.default
    #if PURCHASE_INBOX_TESTS
    let support = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    #else
    guard let support = manager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { throw QueueError.unavailable }
    #endif
    var directory = support.appendingPathComponent("PurchaseInbox", isDirectory: true)
    var attributes: [FileAttributeKey: Any] = [.posixPermissions: 0o700]
    #if os(iOS)
    attributes[.protectionKey] = FileProtectionType.completeUntilFirstUserAuthentication
    #endif
    try manager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: attributes)
    try manager.setAttributes(attributes, ofItemAtPath: directory.path)
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    try directory.setResourceValues(resourceValues)
    let lockFile = directory.appendingPathComponent(".queue.lock")
    let descriptor = open(lockFile.path, O_CREAT | O_RDWR | O_NOFOLLOW, S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw QueueError.unavailable }
    defer { close(descriptor) }
    #if os(iOS)
    try manager.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: lockFile.path)
    #endif
    guard flock(descriptor, LOCK_EX) == 0 else { throw QueueError.unavailable }
    defer { flock(descriptor, LOCK_UN) }
    return try operation(directory)
  }
}
