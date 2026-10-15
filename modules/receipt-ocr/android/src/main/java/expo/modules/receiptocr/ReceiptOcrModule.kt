package expo.modules.receiptocr

import android.graphics.BitmapFactory
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ReceiptOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReceiptOcr")
    AsyncFunction("recognizePdf") { encoded: String ->
      require(encoded.length <= 14_000_000) { "Choose a scanned PDF under 10 MB." }
      val context = requireNotNull(appContext.reactContext)
      val data = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT)
      require(data.size <= 10_000_000) { "Choose a scanned PDF under 10 MB." }
      val file = java.io.File.createTempFile("bank-ocr-", ".pdf", context.cacheDir)
      try {
        file.writeBytes(data)
        android.os.ParcelFileDescriptor.open(file, android.os.ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
          android.graphics.pdf.PdfRenderer(descriptor).use { renderer ->
            require(renderer.pageCount in 1..12) { "Read at most 12 scanned pages at a time." }
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            try {
              (0 until renderer.pageCount).map { index ->
                renderer.openPage(index).use { page ->
                  require(page.width in 1..2000 && page.height in 1..3000)
                  val scale = minOf(3.0, 2200.0 / page.width, 2800.0 / page.height)
                  val bitmap = android.graphics.Bitmap.createBitmap((page.width * scale).toInt(), (page.height * scale).toInt(), android.graphics.Bitmap.Config.ARGB_8888)
                  try {
                    bitmap.eraseColor(android.graphics.Color.WHITE)
                    page.render(bitmap, null, null, android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    val result = com.google.android.gms.tasks.Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)), 30, java.util.concurrent.TimeUnit.SECONDS)
                    val items = result.textBlocks.flatMap { it.lines }.take(2000).mapNotNull { line ->
                      line.boundingBox?.let { box -> mapOf("text" to line.text.take(500), "x" to box.left / scale, "y" to box.bottom / scale, "width" to box.width() / scale, "height" to box.height() / scale, "confidence" to line.confidence.toDouble()) }
                    }
                    mapOf("page" to index + 1, "items" to items)
                  } finally { bitmap.recycle() }
                }
              }
            } finally { recognizer.close() }
          }
        }
      } finally { file.delete() }
    }
    AsyncFunction("recognize") { source: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null || !source.startsWith("file:")) {
        promise.reject("PHOTO_UNAVAILABLE", "Choose a local receipt photo.", null)
        return@AsyncFunction
      }
      val uri = Uri.parse(source)
      val file = java.io.File(uri.path ?: "")
      if (!file.exists() || file.length() > 10 * 1024 * 1024) {
        promise.reject("PHOTO_SIZE", "Choose a local receipt photo under 10 MB.", null)
        return@AsyncFunction
      }
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(file.path, bounds)
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outWidth.toLong() * bounds.outHeight.toLong() > 16_000_000) {
        promise.reject("PHOTO_DIMENSIONS", "Crop this image to the receipt before reading it. Manual entry is still available.", null)
        return@AsyncFunction
      }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try {
        val image = InputImage.fromFilePath(context, uri)
        recognizer.process(image).addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { it.lines }.take(400).map { line ->
            mapOf("text" to line.text.take(200), "confidence" to line.confidence.toDouble())
          }
          promise.resolve(lines)
        }.addOnFailureListener { promise.reject("READ_FAILED", "Text could not be read. Enter the details manually.", null) }
          .addOnCompleteListener { recognizer.close() }
      } catch (_: Exception) {
        recognizer.close()
        promise.reject("READ_FAILED", "Text could not be read. Enter the details manually.", null)
      }
    }
  }
}
