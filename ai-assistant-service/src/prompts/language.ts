import { LOCALE_PATTERN } from '../contracts/schemas';

const MAX_LOCALE_LENGTH = 35;

/**
 * The line that asks the model to write in the operator's language, or null
 * when nothing needs to be said (no locale, English, or not a real language).
 *
 * The locale comes from the browser, so it is untrusted: it must look like a
 * language code, and only the language's English name and the two or three
 * letter code are ever put into the prompt, never the raw string.
 */
export function languageInstruction(locale?: string): string | null {
  if (
    !locale ||
    locale.length > MAX_LOCALE_LENGTH ||
    !LOCALE_PATTERN.test(locale)
  ) {
    return null;
  }

  const code = locale.split('-')[0].toLowerCase();
  if (code === 'en') {
    return null;
  }

  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'language' }).of(code);
  } catch {
    return null;
  }
  // an unknown code comes back unchanged
  if (!name || name.toLowerCase() === code) {
    return null;
  }

  return `The operator's language is ${name} (language code "${code}"). Write in ${name}.`;
}
