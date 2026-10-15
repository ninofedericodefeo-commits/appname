import ExpoModulesCore
import Vision
import ImageIO
import PDFKit
import UIKit

public class ReceiptOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptOcr")
    AsyncFunction("recognizePdf") { (encoded: String) -> [[String: Any]] in
      guard encoded.count <= 14_000_000, let data = Data(base64Encoded: encoded), data.count <= 10_000_000,
            let document = PDFDocument(data: data), !document.isLocked, document.pageCount > 0, document.pageCount <= 12 else {
        throw NSError(domain: "ReceiptOcr", code: 2, userInfo: [NSLocalizedDescriptionKey: "Choose an unlocked scanned PDF up to 12 pages and 10 MB."])
      }
      var pages: [[String: Any]] = []
      for index in 0..<document.pageCount {
        let page: [String: Any] = try autoreleasepool {
          guard let pdfPage = document.page(at: index) else { throw NSError(domain: "ReceiptOcr", code: 3) }
          let bounds = pdfPage.bounds(for: .mediaBox)
          guard bounds.width > 0, bounds.height > 0, bounds.width < 2000, bounds.height < 3000 else { throw NSError(domain: "ReceiptOcr", code: 4) }
          let scale = min(3, min(2200 / bounds.width, 2800 / bounds.height))
          let width = Int(bounds.width * scale), height = Int(bounds.height * scale)
          guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw NSError(domain: "ReceiptOcr", code: 5) }
          context.setFillColor(UIColor.white.cgColor); context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
          context.scaleBy(x: scale, y: scale); context.translateBy(x: -bounds.minX, y: -bounds.minY)
          pdfPage.draw(with: .mediaBox, to: context)
          guard let image = context.makeImage() else { throw NSError(domain: "ReceiptOcr", code: 6) }
          let request = VNRecognizeTextRequest(); request.recognitionLevel = .accurate; request.recognitionLanguages = ["en-US"]; request.usesLanguageCorrection = false
          try VNImageRequestHandler(cgImage: image, orientation: .up).perform([request])
          let items: [[String: Any]] = (request.results ?? []).prefix(2000).compactMap { observation in
            guard let value = observation.topCandidates(1).first else { return nil }
            let box = observation.boundingBox
            return ["text": String(value.string.prefix(500)), "x": box.minX * bounds.width, "y": (1 - box.minY) * bounds.height, "width": box.width * bounds.width, "height": box.height * bounds.height, "confidence": Double(value.confidence)]
          }
          return ["page": index + 1, "items": items]
        }
        pages.append(page)
      }
      return pages
    }
    AsyncFunction("recognize") { (uri: String) -> [[String: Any]] in
      guard let url = URL(string: uri), url.isFileURL,
            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 10 * 1024 * 1024,
            let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, [
              kCGImageSourceCreateThumbnailFromImageAlways: true,
              kCGImageSourceCreateThumbnailWithTransform: true,
              kCGImageSourceThumbnailMaxPixelSize: 2800
            ] as CFDictionary) else {
        throw NSError(domain: "ReceiptOcr", code: 1, userInfo: [NSLocalizedDescriptionKey: "Choose a local receipt photo under 10 MB."])
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["en-US"]
      request.usesLanguageCorrection = true
      try VNImageRequestHandler(cgImage: cgImage, orientation: .up).perform([request])
      return (request.results ?? []).prefix(400).compactMap { observation in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        return ["text": String(candidate.string.prefix(200)), "confidence": Double(candidate.confidence)]
      }
    }
  }
}
