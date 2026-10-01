import AppKit
import Foundation

private let ink = NSColor(srgbRed: 23 / 255, green: 58 / 255, blue: 53 / 255, alpha: 1)
private let cream = NSColor(srgbRed: 1, green: 254 / 255, blue: 249 / 255, alpha: 1)
private let orange = NSColor(srgbRed: 216 / 255, green: 91 / 255, blue: 52 / 255, alpha: 1)

private func render(size: Int, background: Bool, monochrome: Bool = false, compact: Bool = false, to path: String) {
  let image = NSImage(size: NSSize(width: size, height: size))
  image.lockFocus()
  let scale = CGFloat(size) / 1024
  NSGraphicsContext.current?.imageInterpolation = .high

  if background {
    ink.setFill()
    NSRect(x: 0, y: 0, width: size, height: size).fill()
  }

  if !compact {
    let markScale: CGFloat = background ? 1 : 0.74
    func fitted(_ value: CGFloat) -> CGFloat { (512 + (value - 512) * markScale) * scale }
    let glyphSize = 775 * scale * markScale
    let attributes: [NSAttributedString.Key: Any] = [
      .font: NSFont.systemFont(ofSize: glyphSize, weight: .black),
      .foregroundColor: monochrome ? NSColor.white : cream,
    ]
    ("G" as NSString).draw(in: NSRect(x: fitted(140), y: fitted(77), width: 740 * scale * markScale, height: 830 * scale * markScale), withAttributes: attributes)
    (monochrome ? NSColor.white : orange).setFill()
    NSRect(x: fitted(718), y: fitted(503), width: 107 * scale * markScale, height: 100 * scale * markScale).fill()
  }

  image.unlockFocus()
  guard let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let png = bitmap.representation(using: .png, properties: [:]) else {
    fatalError("Could not render \(path)")
  }
  try! png.write(to: URL(fileURLWithPath: path))
}

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets")
render(size: 1024, background: true, to: assets.appendingPathComponent("icon.png").path)
render(size: 1024, background: true, to: assets.appendingPathComponent("splash-icon.png").path)
render(size: 512, background: true, compact: true, to: assets.appendingPathComponent("android-icon-background.png").path)
render(size: 512, background: false, to: assets.appendingPathComponent("android-icon-foreground.png").path)
render(size: 432, background: false, monochrome: true, to: assets.appendingPathComponent("android-icon-monochrome.png").path)
render(size: 48, background: true, to: assets.appendingPathComponent("favicon.png").path)
