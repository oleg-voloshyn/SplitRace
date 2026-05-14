import { View } from 'react-native';
import { WebView } from 'react-native-webview';

function RichDescription({ html, style }) {
  if (!html) {
    return null;
  }

  const document = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      body { color: #444; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      p, ul, ol, h1, h2, h3, h4, blockquote, pre { margin: 0 0 10px; }
      h1, h2 { font-size: 17px; }
      h3, h4 { font-size: 16px; }
      ul, ol { padding-left: 20px; }
      blockquote { border-left: 3px solid #ddd; color: #555; padding-left: 10px; }
      code, pre { background: #f1f3f5; border-radius: 4px; }
      code { padding: 1px 4px; }
      pre { padding: 8px; overflow-x: auto; }
      a { color: #e53935; }
      body > :last-child { margin-bottom: 0; }
    </style>
  </head>
  <body>${html}</body>
</html>`;

  return (
    <View style={style}>
      <WebView
        source={{ html: document, baseUrl: 'about:blank' }}
        javaScriptEnabled={false}
        originWhitelist={['about:blank']}
        onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
        scrollEnabled={false}
        style={{ height: 140, backgroundColor: 'transparent' }}
      />
    </View>
  );
}

export default RichDescription;
