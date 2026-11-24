# Security Specification for Firestore Rules

## 1. Data Invariants
1. Every document in `/projects/{projectId}` and `/experiences/{experienceId}` must use a valid alphanumeric/hyphen/underscore document ID (`<= 128` chars) and contain exact schema fields with no shadow fields.
2. Only verified admin users (`isAdmin()`) with `request.auth.token.email_verified == true` (or registered in `/admins/{uid}`) may create, update, or delete `/projects/{projectId}` or `/experiences/{experienceId}` documents.
3. On `create`, `authorId` must equal `request.auth.uid`, and both `createdAt` and `updatedAt` must equal `request.time`.
4. On `update`, `authorId` and `createdAt` are immutable (`incoming().authorId == existing().authorId` and `incoming().createdAt == existing().createdAt`), and `updatedAt` must equal `request.time`.
5. `imageDataUrl` must match `^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$` and stay `<= 750000` bytes to respect Firestore's 1MB document limit and prevent SVG/HTML XSS payloads.
6. Experience arrays (`bullets`, `bulletsId`, `systems`) are strictly bounded in size (`<= 15` bullets, `<= 25` systems) and guarded for string content.
7. `/admins/{adminId}` is strictly read-only for the matching UID (`request.auth.uid == adminId`) and never writable from client SDKs to prevent privilege escalation.

## 2. Red Team Payload Matrix ("Dirty Dozen")
1. Unauthenticated `create` on `/projects/p1` or `/experiences/e1` -> `PERMISSION_DENIED`
2. Authenticated non-admin user `create` or `update` -> `PERMISSION_DENIED`
3. Unverified email (`email_verified: false`) matching admin email `create` -> `PERMISSION_DENIED`
4. Shadow field injection (`isVerified: true`) on `create` -> `PERMISSION_DENIED`
5. Spoofed `authorId` (`authorId: "other-uid"`) on `create` -> `PERMISSION_DENIED`
6. Client-forged `createdAt` timestamp (`createdAt != request.time`) on `create` -> `PERMISSION_DENIED`
7. Oversized or non-image `imageDataUrl` (`data:image/svg+xml;base64,...` or `> 750000` chars) -> `PERMISSION_DENIED`
8. Invalid category or status (`status: "hacked"`) -> `PERMISSION_DENIED`
9. Invalid document ID (`id` > 128 chars or containing spaces/symbols) -> `PERMISSION_DENIED`
10. Modifying immutable `authorId` or `createdAt` on `update` -> `PERMISSION_DENIED`
11. Self-promotion write (`setDoc` on `/admins/{uid}`) -> `PERMISSION_DENIED`
12. `list` query on `/admins` collection -> `PERMISSION_DENIED`
