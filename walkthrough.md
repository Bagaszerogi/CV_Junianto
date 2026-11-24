# Security Summary

**Reviewed Files**: 19
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Admin Email Fallback | `server.ts` | 338 | If `ADMIN_PASSWORD` was set without `ADMIN_EMAIL`, `emailMatches` defaulted to `true` for any email address. | High | Fixed | Updated `getEnvAdminConfig()` to require a valid `ADMIN_EMAIL` alongside `ADMIN_PASSWORD` and fail closed (`503`) if misconfigured. |
| Rate Limiting & Setup Password | `server.ts` | 283 | `/api/auth/setup` lacked request rate limiting and accepted 6-character passwords, and proxy client IPs were not trusted. | Medium | Fixed | Enabled `app.set('trust proxy', 1)`, enforced `checkRateLimit` on `/api/auth/setup`, raised minimum setup password length to 10 characters, and pruned/capped in-memory auth maps. |
| Firestore Array & Path Validation | `firestore.rules` | 37, 119 | `profile.metrics` only validated `metrics[0] is map` without field-level bounds; `portraitDataUrl` regex allowed `.` without blocking `..`; `profile.email` lacked format check. | Medium | Fixed | Added `isValidMetric()` across all allowed metric slots (1–6), blocked `..` in `isValidPortrait()`, enforced email pattern validation, and required non-empty strings on `bullets`, `bulletsId`, `systems`, and `items`. |
| Unvalidated Dynamic Links & Images | `src/components/HeroSection.tsx`, `src/components/ContactSection.tsx`, `src/components/ProjectsSection.tsx`, `src/components/ProfileEditModal.tsx` | 188, 41, 450, 156 | Dynamic `mailto:`, `WhatsApp`, and `img src` bindings rendered stored strings without client-side scheme filtering. | Medium | Fixed | Created `src/utils/safeUrls.ts` (`sanitizeEmailForHref`, `sanitizeWhatsAppHref`, `sanitizePortraitSrc`, `sanitizeProjectImageSrc`) and applied across all dynamic links and images. |
| Unchecked Document IDs | `src/utils/cvFirestoreApi.ts`, `src/utils/projectApi.ts`, `src/utils/experienceApi.ts` | 297, 178, 157 | Client Firestore update/delete helpers did not validate document ID patterns prior to sending requests. | Low | Fixed | Added strict `^[a-zA-Z0-9_-]{1,128}$` and `isValidEmailAddress` checks prior to Firestore calls. |
| Vercel Routing & Security Headers | `vercel.json` | 7, 12 | Catch-all rewrite intercepted `/api/*` before serverless functions, and HTTP security headers (including COOP for Firebase popup auth) were missing. | Medium | Fixed | Routed `/api/(.*)` to `/api/index.ts` ahead of SPA fallback `/((?!api/).*)` and added `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and `Cross-Origin-Opener-Policy: same-origin-allow-popups`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Firestore Default-Deny & RBAC | `firestore.rules` | Default-deny catch-all at root; admin writes require `request.auth != null` plus verified email allowlist (`email_verified == true`) or `/admins/{uid}` registry; `/admins` writes are permanently blocked. |
| Immutable Ownership & Server Timestamps | `firestore.rules` | Create enforces `authorId == request.auth.uid` and `createdAt == request.time`; updates enforce immutable `authorId`/`createdAt`, `updatedAt == request.time`, and strict `affectedKeys().hasOnly(...)` allowlists. |
| Image XSS & Document Size Guard | `firestore.rules`, `src/utils/projectApi.ts` | Only `jpeg`, `png`, and `webp` base64 data URLs (or safe `/assets/` paths for portraits) within size limits are permitted, blocking `svg+xml` and oversized payloads. |
| Auth Token Caching & Headers | `server.ts` | `x-powered-by` is disabled, security headers are applied to all responses, and `/api/auth/*` sets `Cache-Control: no-store`. |
| Safe Text Rendering | `src/components/*.tsx` | All user and database text is rendered through React JSX text bindings with zero `dangerouslySetInnerHTML`, `innerHTML`, or `eval`. |

---

## PoC Verification

### 1. Missing `ADMIN_EMAIL` Login Bypass Prevention

#### Summary
| Field | Value |
|---|---|
| Issue Type | Broken Authentication Fallback |
| Impact | High |
| Affected File | `server.ts:106` |
| Test Scenario | `POST /api/auth/login` with `ADMIN_PASSWORD` configured in environment variables, `ADMIN_EMAIL` unset, and arbitrary attacker email `attacker@example.com`. |

#### How It Was Fixed
`getEnvAdminConfig()` now validates `EMAIL_RE.test(envEmail)` whenever `ADMIN_PASSWORD` is present and flags incomplete configuration so `/api/auth/login` rejects the request with `503` instead of accepting arbitrary email addresses.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request hits `POST /api/auth/login` at `server.ts:320` | Rate limit and input format checked |
| 2 | `getEnvAdminConfig()` at `server.ts:106` sees `ADMIN_PASSWORD` is set while `ADMIN_EMAIL` is empty | Returns `{ email: '', password, misconfigured: true }` |
| 3 | Login handler at `server.ts:331` checks `if (envConfig.misconfigured || !envConfig.email)` | **Handled Safely** (`503 Server admin email is not configured.`) |

#### Conclusion
**Fix Verified** - An unconfigured `ADMIN_EMAIL` can no longer allow arbitrary emails to authenticate against `ADMIN_PASSWORD`.

---

### 2. Malicious Metric Object & Portrait Traversal Blocked in Firestore Rules

#### Summary
| Field | Value |
|---|---|
| Issue Type | Incomplete Schema Validation |
| Impact | Medium |
| Affected File | `firestore.rules:37, 119` |
| Test Scenario | `updateDoc` on `/profile/main` containing `portraitDataUrl: "/assets/../secret"` or a `metrics[1]` object with a shadow field `isAdmin: true`. |

#### How It Was Fixed
`isValidPortrait()` rejects any path containing `..`, and `isValidMetric()` strictly enforces `keys().hasAll(...)`, `keys().hasOnly(...)`, and string size bounds across every element up to index 5.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Write reaches `match /profile/{profileId}` at `firestore.rules:253` | Invokes `isValidProfile(incoming())` |
| 2 | `isValidPortrait(data.portraitDataUrl)` checks `!val.matches('.*\\.\\..*')` | Rejects `..` path sequences |
| 3 | `isValidMetric(data.metrics[1])` checks `m.keys().hasOnly([...])` | **Handled Safely** (Rejected with `PERMISSION_DENIED`) |

#### Conclusion
**Fix Verified** - Path traversal strings in portraits and shadow keys inside `metrics` arrays are rejected at the Firestore rules boundary.

---

### 3. Unsafe URL Scheme Injection Blocked in Profile & Project UI

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsafe Link / Image URI Handling |
| Impact | Medium |
| Affected File | `src/utils/safeUrls.ts:1` |
| Test Scenario | Profile record containing `whatsappHref: "javascript:alert(1)"` or `imageDataUrl: "data:image/svg+xml;base64,..."`. |

#### How It Was Fixed
Client rendering passes all dynamic `mailto:`, WhatsApp, portrait, and project image URLs through strict allowlist regex checks in `src/utils/safeUrls.ts` before attaching them to `href` or `src` attributes.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Component renders `sanitizeWhatsAppHref(profile.whatsappHref)` or `sanitizeProjectImageSrc(...)` | Enters `src/utils/safeUrls.ts` |
| 2 | `SAFE_WA_RE` (`^https://wa\.me/[0-9]+$`) and `SAFE_DATA_IMG_RE` (`^data:image/(jpeg|png|webp);base64,...`) fail to match | Rejects unsafe scheme |
| 3 | Fallback value (`#` or empty string / fallback portrait) returned | **Handled Safely** (No `javascript:` or SVG script execution) |

#### Conclusion
**Fix Verified** - Untrusted URL schemes are neutralized before reaching DOM link or image attributes.
