import translationsEs from './translations-es';

let currentLanguage = 'es';

export function setTranslationLanguage(lang: string) {
  currentLanguage = lang;
}

export function customTranslate(template: string, replacements: any) {
  replacements = replacements || {};

  // Translate if language is Spanish
  let translated = template;
  if (currentLanguage === 'es') {
    translated = (translationsEs as any)[template] || template;
  }

  // Replace
  return translated.replace(/{([^}]+)}/g, function (_: string, key: string) {
    let value = replacements[key];
    if (typeof value === 'undefined') {
      return '{' + key + '}';
    }
    return value;
  });
}

export const customTranslateModule = {
  __init__: ['translate'],
  translate: ['value', customTranslate]
};
