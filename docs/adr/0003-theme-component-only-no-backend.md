# Theme component only: no backend, no dependencies, on-device TTS

This project is a Discourse theme component and nothing else. There is
deliberately no server plugin, no API keys, no external TTS service and no audio
file generation — speech comes from the browser's Web Speech API on the
visitor's device. The explicit no-s protect the core value: zero setup, zero
cost, zero privacy exposure. Roadmap ideas that need a server (e.g.
pre-generated MP3s with a cloud TTS) stay out of scope by design.
