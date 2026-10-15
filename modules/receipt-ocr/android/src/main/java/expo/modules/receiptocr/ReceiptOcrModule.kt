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
