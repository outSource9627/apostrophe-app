/**
 * Links the bundled font files into both native projects.
 *
 * Run `npx react-native-asset` after changing this. The files in the folder
 * below are named after each face's PostScript name, which is what
 * `fontFamilyNative` in the design tokens refers to — iOS resolves a face by
 * PostScript name and Android by filename, so the two only agree if the
 * filename IS the PostScript name.
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts'],
}
