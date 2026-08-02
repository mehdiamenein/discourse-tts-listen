// The default_voice and fallback_voice settings changed from free-text
// strings (a voice name OR a language code) to an enum of language codes.
// Values already in the new choices list are kept as-is; anything else — a
// voice name like "Google Deutsch", or an empty value — becomes "auto"
// (no preference: follow the platform's default language).
const LANGUAGES = [
  "auto", "de", "de-AT", "de-CH", "de-DE", "en", "en-AU", "en-CA", "en-GB",
  "en-IN", "en-US", "fr", "fr-CA", "fr-FR", "es", "es-419", "es-ES", "es-MX",
  "it", "it-IT", "pt", "pt-BR", "pt-PT", "nl", "nl-NL", "ru", "pl", "tr",
  "sv", "da", "nb", "fi", "el", "cs", "hu", "ro", "uk", "bg", "hr", "sk",
  "sl", "sr", "he", "ar", "hi", "ur", "fa", "th", "vi", "id", "ms", "ja",
  "ko", "zh-CN", "zh-TW", "ca", "et", "lt", "lv", "sq", "sw", "gl", "eu",
];

export default function migrate(settings) {
  for (const name of ["default_voice", "fallback_voice"]) {
    if (settings.has(name)) {
      const value = String(settings.get(name)).trim().toLowerCase();
      settings.set(name, LANGUAGES.includes(value) ? value : "auto");
    }
  }
  return settings;
}
