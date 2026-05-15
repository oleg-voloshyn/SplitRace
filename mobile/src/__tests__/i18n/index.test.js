import * as Localization from 'expo-localization';

describe('SUPPORTED_LANGS', () => {
  beforeEach(() => jest.resetModules());

  it('includes en and uk', () => {
    const { SUPPORTED_LANGS } = require('../../i18n');
    const codes = SUPPORTED_LANGS.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('uk');
  });

  it('has a non-empty label for each language', () => {
    const { SUPPORTED_LANGS } = require('../../i18n');
    SUPPORTED_LANGS.forEach((l) => {
      expect(typeof l.label).toBe('string');
      expect(l.label.length).toBeGreaterThan(0);
    });
  });

  it('has exactly 2 supported languages', () => {
    const { SUPPORTED_LANGS } = require('../../i18n');
    expect(SUPPORTED_LANGS).toHaveLength(2);
  });
});

describe('language detection', () => {
  beforeEach(() => jest.resetModules());

  it('picks Ukrainian when device language is uk', () => {
    const localization = require('expo-localization');
    localization.getLocales.mockReturnValue([{ languageCode: 'uk' }]);
    const i18n = require('../../i18n').default;
    expect(i18n.language).toBe('uk');
  });

  it('falls back to en for unsupported language (zh)', () => {
    const localization = require('expo-localization');
    localization.getLocales.mockReturnValue([{ languageCode: 'zh' }]);
    const i18n = require('../../i18n').default;
    expect(i18n.language).toBe('en');
  });

  it('falls back to en when getLocales returns empty array', () => {
    const localization = require('expo-localization');
    localization.getLocales.mockReturnValue([]);
    const i18n = require('../../i18n').default;
    expect(i18n.language).toBe('en');
  });

  it('falls back to en when getLocales returns null languageCode', () => {
    const localization = require('expo-localization');
    localization.getLocales.mockReturnValue([{ languageCode: null }]);
    const i18n = require('../../i18n').default;
    expect(i18n.language).toBe('en');
  });
});
