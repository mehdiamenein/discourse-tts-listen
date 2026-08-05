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
    // iPadOS reports a desktop Mac UA; carry both so Apple voices listed
    // under macOS still match on an iPad.
    os = ["iPadOS", "macOS"];
  } else if (ua.includes("iphone") || ua.includes("ipod")) {
    os = ["iOS"];
  } else if (ua.includes("android")) {
    os = ["Android"];
  } else if (ua.includes("cros")) {
    os = ["ChromeOS"];
  } else if (ua.includes("mac") || uaPlatform.includes("mac")) {
    os = ["macOS"];
  } else if (ua.includes("win") || uaPlatform.includes("win")) {
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
