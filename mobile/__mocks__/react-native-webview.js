const React = require('react');
const { View } = require('react-native');

const WebView = React.forwardRef((props, ref) => React.createElement(View, { testID: props.testID ?? 'webview' }));

module.exports = { WebView };
