// Pure platform detection: map the visitor's `navigator` to the coarse
// `os`/`browser` tags the recommended-voice index (ADR 0008) is keyed by.
//
// Returns arrays of candidate tags so a device that is ambiguous (an iPad
// reports a desktop Mac UA) can carry more than one. A recommended-voice
// entry with no `os`/`browser` tags is considered available on every
// platform; otherwise at least one of the entry's tags must appear among the
// detected candidates. This is a best-effort filter, not authoritative — see
// ADR 0008.
//
// Tags follow Readium Speech: `os` ∈ `macOS`/`iOS`/`iPadOS`/`Windows`/`Android`/
// `ChromeOS`; `browser` ∈ `Edge`/`ChromeDesktop` (Safari, Firefox, and mobile
// browsers get no browser-specific recommended voices).

// Word-boundary token checks: a loose substring like ua.includes("win") or
// .includes("mac") would also fire on "darwin"/"machine"-style tokens and is
// only saved by branch order; real UAs always carry one of these explicit
// tokens, so the checks are robust on their own.
const MAC_OS_UA = /\bmac os\b|\bmacintosh\b/;
const WINDOWS_UA = /\bwindows\b|\bwin32\b|\bwin64\b/;

/**
 * @param {Navigator} navigator
 * @returns {{ os: string[], browser: string[] }}
 */
export function detectPlatform(navigator) {
  const ua = String(navigator?.userAgent || "").toLowerCase();
  const uaPlatform = String(
    navigator?.userAgentData?.platform || navigator?.platform || ""
  ).toLowerCase();

  let os = [];
  if (ua.includes("ipad")) {
    // Mobile-mode iPads send a literal "iPad" UA; carry macOS too because
    // Apple voices are tagged macOS and a desktop-mode iPad sends a plain
    // Macintosh UA, which only hits the macOS branch below. The dual tag
    // keeps both iPad modes matching the same Apple entries.
    os = ["iPadOS", "macOS"];
  } else if (ua.includes("iphone") || ua.includes("ipod")) {
    os = ["iOS"];
  } else if (ua.includes("android")) {
    os = ["Android"];
  } else if (ua.includes("cros")) {
    os = ["ChromeOS"];
  } else if (MAC_OS_UA.test(ua) || uaPlatform.startsWith("mac")) {
    os = ["macOS"];
  } else if (WINDOWS_UA.test(ua) || uaPlatform.startsWith("win")) {
    os = ["Windows"];
  }

  let browser = [];
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
  // Edge's UA contains "Edg/"; check it before Chrome so an Edge desktop
  // browser (which also contains "Chrome/") is not mislabeled
  // ChromeDesktop. Mobile browsers get no browser-specific voices.
  if (ua.includes("edg/")) {
    browser = ["Edge"];
  } else if (ua.includes("chrome/") && !isMobile) {
    browser = ["ChromeDesktop"];
  }

  return { os, browser };
}
