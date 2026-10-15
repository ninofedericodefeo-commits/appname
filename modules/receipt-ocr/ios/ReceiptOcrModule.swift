import ExpoModulesCore
import Vision
import ImageIO

public class ReceiptOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptOcr")
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
