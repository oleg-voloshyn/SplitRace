const React = require('react');
const { View } = require('react-native');

const ViewShot = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    capture: jest.fn().mockResolvedValue('file:///tmp/screenshot.png')
  }));
  return React.createElement(View, { testID: props.testID ?? 'viewshot', ...props });
});

module.exports = ViewShot;
module.exports.default = ViewShot;
