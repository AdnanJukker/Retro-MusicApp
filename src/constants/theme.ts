/**
 * Design tokens for the retro hi-fi music app.
 * Single warm analog palette (no dark mode) — see AGENTS.md design system.
 */

export const Colors = {
  background: '#F3E9D2',
  well: '#D9C7A3',
  surface: '#F8F1E1',
  surfaceRaised: '#FCF7EC',
  ink: '#24201C',
  textSecondary: '#6C6259',
  accent: '#A94725',
  accentSoft: '#E7C6B4',
  gold: '#D6A84B',
  goldSoft: '#EBDBB6',
  olive: '#6D7055',
  oliveSoft: '#DADCC9',
  hairline: 'rgba(36, 32, 28, 0.15)',
  hairlineStrong: 'rgba(36, 32, 28, 0.4)',
  overlayInk: 'rgba(36, 32, 28, 0.06)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const Radius = {
  none: 0,
  sm: 6,
  md: 8,
  full: 999,
} as const;

export const FontFamily = {
  displayBold: 'BarlowCondensed_700Bold',
  displaySemiBold: 'BarlowCondensed_600SemiBold',
  displayMedium: 'BarlowCondensed_500Medium',
  bodyRegular: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemiBold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  monoRegular: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

// Every variant carries the default ink color so plain `<Text style={Type.x}>`
// never falls back to RN's pure-black default — callers still override color
// by appending a style after the Type entry in a style array.
export const Type = {
  displayHero: {
    fontFamily: FontFamily.displayBold,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 0.2,
    textTransform: 'uppercase' as const,
    color: Colors.ink,
  },
  headlineLg: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    color: Colors.ink,
  },
  headlineMd: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 20,
    lineHeight: 23,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    color: Colors.ink,
  },
  headlineSm: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: Colors.ink,
  },
  bodyLg: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
    color: Colors.ink,
  },
  bodyMd: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.ink,
  },
  bodyMdSemiBold: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.ink,
  },
  bodySm: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.ink,
  },
  labelCaps: {
    fontFamily: FontFamily.displaySemiBold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    color: Colors.ink,
  },
  techLg: {
    fontFamily: FontFamily.monoBold,
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: 0.4,
    color: Colors.ink,
  },
  techMd: {
    fontFamily: FontFamily.monoRegular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: Colors.ink,
  },
  techMdBold: {
    fontFamily: FontFamily.monoBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: Colors.ink,
  },
  techSm: {
    fontFamily: FontFamily.monoBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: Colors.ink,
  },
} as const;

/** Height reserved for the custom bottom tab bar. */
export const TabBarHeight = 62;
/** Height reserved for the persistent mini player dock. */
export const MiniPlayerHeight = 60;
