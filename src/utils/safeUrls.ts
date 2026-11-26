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

export function sanitizePortraitSrc(src: string, fallback = '/assets/portrait.png'): string {
  const trimmed = src.trim();
  if (trimmed === '') {
    return '';
  }
  if (trimmed.length >= 5 && trimmed.length <= 750_000 && !trimmed.includes('..')) {
    if (SAFE_ASSET_RE.test(trimmed) || SAFE_DATA_IMG_RE.test(trimmed)) {
      return trimmed;
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
