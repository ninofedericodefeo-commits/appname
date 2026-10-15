Pod::Spec.new do |s|
  s.name = 'ReceiptOcr'
  s.version = '1.0.0'
  s.summary = 'On-device receipt text recognition for GasFinder'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'GasFinder'
  s.homepage = 'https://github.com/ninofedericodefeo-commits/appname'
  s.source = { :git => s.homepage }
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.source_files = '**/*.swift'
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'UIKit', 'ImageIO', 'PDFKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
