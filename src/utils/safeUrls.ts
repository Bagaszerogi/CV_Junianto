const SAFE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_WA_RE = /^https:\/\/wa\.me\/[0-9]+$/;
const SAFE_ASSET_RE = /^\/assets\/[a-zA-Z0-9_./-]+$/;
const SAFE_DATA_IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function isValidEmailAddress(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.length <= 140 && SAFE_EMAIL_RE.test(trimmed);
}

export function sanitizeEmailForHref(email: string): string {
  const trimmed = email.trim();
  return isValidEmailAddress(trimmed) ? trimmed : '';
}

export function sanitizeWhatsAppHref(url: string): string {
  const trimmed = url.trim();
  return SAFE_WA_RE.test(trimmed) ? trimmed : '#';
}

export const DEFAULT_PORTRAIT_SRC = '/assets/aistudio/Untitled_design__1__6dcbc7fc.png';
const LEGACY_PORTRAIT_PATHS = new Set(['/assets/portrait.png']);

export function normalizePortraitValue(src: string): string {
  const trimmed = src.trim();
  if (LEGACY_PORTRAIT_PATHS.has(trimmed)) {
    return DEFAULT_PORTRAIT_SRC;
  }
  return trimmed;
}

export function sanitizePortraitSrc(src: string, fallback = DEFAULT_PORTRAIT_SRC): string {
  const normalized = normalizePortraitValue(src);
  if (normalized === '') {
    return '';
  }
  if (normalized.length >= 5 && normalized.length <= 920_000 && !normalized.includes('..')) {
    if (SAFE_ASSET_RE.test(normalized) || SAFE_DATA_IMG_RE.test(normalized)) {
      return normalized;
    }
  }
  return fallback;
}

export function sanitizeProjectImageSrc(src: string): string {
  const trimmed = src.trim();
  if (trimmed.length >= 24 && trimmed.length <= 750_000 && SAFE_DATA_IMG_RE.test(trimmed)) {
    return trimmed;
  }
  return '';
}
