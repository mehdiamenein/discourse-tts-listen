# Voice selection lives in a pure module, unit-tested by QUnit in CI

The `selectVoice` decision — which device voice the player starts with — is
extracted into a dependency-free module
(`javascripts/discourse/lib/tts-selection.js`) so it can be unit-tested without
a Discourse runtime. The QUnit suite in `test/javascripts/` only executes inside
a Discourse container in CI; locally the same assertions are verified through
Node. Theme test imports address theme modules **without** the `javascripts/`
prefix (Discourse keys them relative to `javascripts/`) — an easy foot-gun when
adding the next test file.
