const SAFE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_WA_RE = /^https:\/\/wa\.me\/[0-9]+$/;
const SAFE_ASSET_RE = /^\/assets\/[a-zA-Z0-9_./-]+$/;
const SAFE_DATA_IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export const MEDIA_PORTRAIT_TOKEN = 'media:portrait';
export const MAX_FIRESTORE_IMAGE_CHARS = 750_000;
export const DEFAULT_PORTRAIT_SRC = '/assets/aistudio/Untitled_design__1__6dcbc7fc.png';

const LEGACY_PORTRAIT_PATHS = new Set(['/assets/portrait.png']);

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

export function isDataImageUrl(src: string): boolean {
  const trimmed = src.trim();
  return trimmed.length >= 26 && SAFE_DATA_IMG_RE.test(trimmed);
}

export function extractDataImageMime(
  src: string
): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const trimmed = src.trim();
  if (trimmed.startsWith('data:image/png;base64,')) return 'image/png';
  if (trimmed.startsWith('data:image/jpeg;base64,')) return 'image/jpeg';
  if (trimmed.startsWith('data:image/webp;base64,')) return 'image/webp';
  return null;
}

export function normalizePortraitValue(src: string): string {
  const trimmed = src.trim();
  if (LEGACY_PORTRAIT_PATHS.has(trimmed)) {
    return DEFAULT_PORTRAIT_SRC;
  }
  return trimmed;
}

export function sanitizePortraitSrc(
  src: string,
  fallback = DEFAULT_PORTRAIT_SRC
): string {
  const normalized = normalizePortraitValue(src);
  if (normalized === '') {
    return '';
  }
  if (normalized === MEDIA_PORTRAIT_TOKEN) {
    return MEDIA_PORTRAIT_TOKEN;
  }
  if (
    normalized.length >= 8 &&
    normalized.length <= 200 &&
    !normalized.includes('..') &&
    SAFE_ASSET_RE.test(normalized)
  ) {
    return normalized;
  }
  if (
    normalized.length >= 26 &&
    normalized.length <= MAX_FIRESTORE_IMAGE_CHARS &&
    SAFE_DATA_IMG_RE.test(normalized)
  ) {
    return normalized;
  }
  return fallback;
}

export function sanitizeProjectImageSrc(src: string): string {
  const trimmed = src.trim();
  if (
    trimmed.length >= 26 &&
    trimmed.length <= MAX_FIRESTORE_IMAGE_CHARS &&
    SAFE_DATA_IMG_RE.test(trimmed)
  ) {
    return trimmed;
  }
  return '';
}
