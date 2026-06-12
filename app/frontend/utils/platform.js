// Single source of truth for platform/browser detection.
// Import from here rather than duplicating UA regexes across components.

export function isIosSafari() {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  // Must be iOS device running Safari — exclude Chrome (crios), Firefox (fxios),
  // Edge (edgios), Opera (opios) and Mercury on iOS, which can't support push
  // even as a PWA regardless of whether they pass the Safari UA check.
  return /iphone|ipad|ipod/i.test(ua) &&
    /safari/i.test(ua) &&
    !/crios|fxios|edgios|opios|mercury/i.test(ua)
}

export function isStandalone() {
  if (typeof window === "undefined") return false
  return navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
}
