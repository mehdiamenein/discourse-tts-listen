// The fallback_voice setting has been removed. The player no longer picks a
// second-choice language: when no installed voice matches the configured
// default_voice, it shows the no-voice notice (see show_no_voice_notice) and
// stays idle instead of falling back. Drop any stored fallback_voice value so
// it does not linger as an orphan key in site settings.
export default function migrate(settings) {
  if (settings.has("fallback_voice")) {
    settings.remove("fallback_voice");
  }
  return settings;
}
