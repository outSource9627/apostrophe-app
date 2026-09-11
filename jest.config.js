module.exports = {
  preset: '@react-native/jest-preset',
  /**
   * node_modules is not transformed by default, but React Native's own packages
   * and @react-navigation ship untranspiled ESM — so Jest hits `export` and
   * reports "unexpected token", which reads like a problem with your code.
   *
   * The preset covers react-native itself; everything after it here is a
   * dependency that also needs Babel. Add to the list rather than widening it
   * to all of node_modules, which would make every run slow.
   */
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react-native|@react-native|@react-navigation|react-native-.*)',
  ],
}
