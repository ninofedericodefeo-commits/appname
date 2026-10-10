import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { parseAmazonLink } from './amazonLink';
import { amazonLookupFallback, draftFromAmazonPage } from './amazonPage';
import type { AmazonLookupProps, AmazonLookupResult } from './amazonPage';
import { AMAZON_READER_SCRIPT } from './amazonReaderScript';

const script = `(function () {
  ${AMAZON_READER_SCRIPT}
  var attempts = 0;
  function read() {
    try {
      var product = readAmazonDocument(document, location.href);
      if (product.priceCents !== null || product.problem === 'blocked' || product.problem === 'unavailable' || product.problem === 'unsupported-currency' || ++attempts >= 12) {
        window.ReactNativeWebView.postMessage(JSON.stringify(product));
      } else { setTimeout(read, 500); }
    } catch (_) { window.ReactNativeWebView.postMessage('{}'); }
  }
  read();
})(); true;`;

export default function AmazonProductLookup({ link, onResult }: AmazonLookupProps) {
  const callback = useRef(onResult);
  useEffect(() => { callback.current = onResult; }, [onResult]);
  const done = useRef(false);
  function finish(result: AmazonLookupResult) {
    if (!done.current) { done.current = true; callback.current(result); }
  }
  useEffect(() => {
    done.current = false;
    const timeout = setTimeout(() => {
      if (!done.current) { done.current = true; callback.current(amazonLookupFallback(link)); }
    }, 20_000);
    return () => { done.current = true; clearTimeout(timeout); };
  }, [link]);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', width: 390, height: 600, opacity: 0, zIndex: -1 }}>
    <WebView source={{ uri: link.sourceUrl }} incognito sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false}
      originWhitelist={['*']} mixedContentMode="never" javaScriptCanOpenWindowsAutomatically={false}
      geolocationEnabled={false} mediaPlaybackRequiresUserAction allowFileAccess={false}
      injectedJavaScript={script} onOpenWindow={() => {}}
      onShouldStartLoadWithRequest={(navigation) => {
        if (navigation.isTopFrame === false) return false;
        const allowed = parseAmazonLink(navigation.url).value;
        if (allowed && (!link.asin || allowed.asin === link.asin)) return true;
        finish(amazonLookupFallback(link, 'Amazon redirected away from this product. Enter its name and full USD price, or try another product link.'));
        return false;
      }}
      onMessage={(event) => {
        if (event.nativeEvent.data.length > 10_000) { finish(amazonLookupFallback(link)); return; }
        try { finish(draftFromAmazonPage(link, JSON.parse(event.nativeEvent.data))); }
        catch { finish(amazonLookupFallback(link)); }
      }}
      onError={() => finish(amazonLookupFallback(link))}
      onHttpError={(event) => {
        if (event.nativeEvent.statusCode >= 400 && parseAmazonLink(event.nativeEvent.url).value) finish(amazonLookupFallback(link));
      }}
    />
  </View>;
}
