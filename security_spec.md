# Security Specification for Firestore Rules

## 1. Data Invariants
1. Every document across `/profile`, `/cvMedia`, `/projects`, `/experiences`, `/techStacks`, `/references`, `/siteContent`, `/cvIndex`, and `/adminsRegistry` uses a validated alphanumeric/hyphen/underscore document ID (`^[a-zA-Z0-9_-]+$`, `<= 128` chars) with exact schema keys enforced (`hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` + full schema validation on update).
2. Write access to master CV collections requires `isAdmin()`: either a verified core admin email (`email_verified == true` in `request.auth.token`), a registered UID record in `/admins/{uid}`, or a verified email listed in `/admins/{emailLower}`.
3. On `create`, `authorId` must equal `request.auth.uid`, and both `createdAt` and `updatedAt` must equal `request.time`.
4. On `update`, `authorId` and `createdAt` are immutable (or self-healed to `request.auth.uid` / `request.time` only when missing/invalid on legacy documents), and `updatedAt` must equal `request.time`.
5. Custom portrait uploads are isolated inside `/cvMedia/portrait` (and published to `/cvProjectAssets/{vaultKey}__portrait`), keeping `/profile/main` and `/cvShares/{vaultKey}` lightweight (`portraitDataUrl` holds `""`, `"media:portrait"`, or `"/assets/..."`). All base64 image fields are prefix-validated (`data:image/(png|jpeg|webp);base64,`) and capped at `<= 750000` characters to stay safely below Firestore's 1 MiB document ceiling and block SVG/HTML XSS.
6. Experience arrays (`bullets`, `bulletsId`, `systems`, `careerStages`) and `metrics` are strictly bounded in element count and item string length.
7. `/invites/{token}` is non-listable (`allow list: if false`) and publicly `get`-readable only when `active == true` and unexpired (`expiresAt == null || expiresAt > request.time`). `/cvShares/{vaultKey}` and `/cvProjectAssets/{assetId}` are non-listable and keyed by unguessable `>= 24`-char `vaultKey` tokens.
8. `/admins/{adminId}` is non-listable and blocks privilege escalation: verified users may only sync their own `/admins/{uid}` document if their verified email is already allowlisted or pre-registered in `/admins/{emailLower}`; adding new admins or modifying `/adminsRegistry` requires an existing `isAdmin()`.

## 2. Red Team Payload Matrix ("Dirty Dozen")
1. Unauthenticated `create` on `/profile/main`, `/cvMedia/portrait`, `/projects/p1`, or `/experiences/e1` -> `PERMISSION_DENIED`
2. Authenticated non-admin user `create`, `update`, or `get` on any private master CV collection -> `PERMISSION_DENIED`
3. Unverified email (`email_verified: false`) matching a core admin email `create` or `update` -> `PERMISSION_DENIED`
4. Shadow field injection (`isVerified: true` or `adminOverride: true`) on `create` or `update` -> `PERMISSION_DENIED`
5. Spoofed `authorId` (`authorId: "other-uid"`) on `create` -> `PERMISSION_DENIED`
6. Client-forged `createdAt` or `updatedAt` timestamp (`!= request.time`) -> `PERMISSION_DENIED`
7. Oversized or dangerous `dataUrl` / `imageDataUrl` (`data:image/svg+xml;base64,...` or `> 750000` chars) -> `PERMISSION_DENIED`
8. Path traversal or arbitrary external URL inside `portraitDataUrl` (`https://evil.com/x.png` or `/assets/../secret`) -> `PERMISSION_DENIED`
9. Invalid document ID (`id` > 128 chars or containing spaces/symbols) or invalid `vaultKey` (< 24 chars) -> `PERMISSION_DENIED`
10. Modifying immutable `authorId` or `createdAt` on `update` when already set -> `PERMISSION_DENIED`
11. Self-promotion write (`setDoc` on `/admins/{uid}`) by a non-allowlisted user -> `PERMISSION_DENIED`
12. `list` query on `/admins`, `/invites`, `/cvShares`, `/cvProjectAssets`, `/profile`, or `/cvMedia` -> `PERMISSION_DENIED`
