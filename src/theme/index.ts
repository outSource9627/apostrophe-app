import * as tokens from './tokens'

export * from './tokens'

export const color = {
  ...tokens.color,
  surfaceSubtle: tokens.color.surfaceMuted,
  accentSubtle: tokens.color.accentSoft,
}

export const fontFamilyNative = {
  ...tokens.fontFamilyNative,
  heading: tokens.fontFamilyNative.bodyBold,
  headingItalic: tokens.fontFamilyNative.displayItalic,
}
