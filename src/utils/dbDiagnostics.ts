import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
} from 'firebase/firestore';
import {
  ADMIN_EMAIL_ALLOWLIST,
  auth,
  db,
  FIREBASE_PUBLIC_META,
} from '../firebase';
import { EXPERIENCES, REFERENCES, TECH_STACK } from '../data/cvData';
import {
  DEFAULT_PROFILE_DATA,
  DEFAULT_SITE_CONTENT,
  saveProfileToFirestore,
  saveReferenceToFirestore,
  saveSiteContentToFirestore,
  saveTechStackToFirestore,
} from './cvFirestoreApi';
import { saveExperienceToFirestore } from './experienceApi';
import { checkIsAdminUser, isRunningInIframe, syncAdminRecord } from './projectApi';
import { ensureCvIndex, readCvIndex, syncPublishedCvSnapshot } from './inviteApi';

export interface CollectionCheckResult {
  key: string;
  label: string;
  path: string;
  status: 'synced' | 'empty-default' | 'auth-required' | 'error';
  docCount: number;
  latencyMs: number;
  error?: string;
}

export interface DatabaseAuditReport {
  checkedAt: string;
  overallConnected: boolean;
  authRequired: boolean;
  isAuthorizedAdmin: boolean;
  totalLatencyMs: number;
  projectId: string;
  authDomain: string;
  databaseId: string;
  hostname: string;
  isIframe: boolean;
  authState: {
    signedIn: boolean;
    uid: string | null;
    email: string | null;
    emailVerified: boolean;
    providerIds: string[];
    inAllowlist: boolean;
    adminDocSynced: boolean | null;
    adminSyncError: string | null;
    adminUidDocExists: boolean | null;
    adminEmailDocExists: boolean | null;
    writeAccessOk: boolean;
    blockReason: 'not-signed-in' | 'email-unverified' | 'not-in-admin-list' | null;
  };
  collections: CollectionCheckResult[];
}

const PRIVATE_COLLECTIONS: Array<{ key: string; label: string; path: string }> = [
  { key: 'profile', label: 'Profile & Education', path: 'profile/main' },
  { key: 'cvMedia', label: 'Portrait Media Asset', path: 'cvMedia/portrait' },
  { key: 'siteContent', label: 'UI Copy & Labels', path: 'siteContent/main' },
  { key: 'experiences', label: 'Work Experiences', path: 'experiences' },
  { key: 'projects', label: 'Project Gallery', path: 'projects' },
  { key: 'techStacks', label: 'Technical Skills', path: 'techStacks' },
  { key: 'references', label: 'References', path: 'references' },
  { key: 'cvIndex', label: 'Invite & Vault Index', path: 'cvIndex/admin' },
];

async function probeFirestoreServerReachable(): Promise<{
  reachable: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = performance.now();
  try {
    await getDocFromServer(doc(db, 'invites', '__health_check__'));
    return { reachable: true, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    // Firestore returns permission-denied from the live server when database & network are healthy
    if (lower.includes('permission') || lower.includes('insufficient')) {
      return { reachable: true, latencyMs };
    }
    return { reachable: false, latencyMs, error: msg };
  }
}

async function checkSingleDoc(
  key: string,
  label: string,
  col: string,
  docId: string
): Promise<CollectionCheckResult> {
  const start = performance.now();
  try {
    const snap = await getDocFromServer(doc(db, col, docId));
    const latencyMs = Math.round(performance.now() - start);
    return {
      key,
      label,
      path: `${col}/${docId}`,
      status: snap.exists() ? 'synced' : 'empty-default',
      docCount: snap.exists() ? 1 : 0,
      latencyMs,
    };
  } catch (err) {
    return {
      key,
      label,
      path: `${col}/${docId}`,
      status: 'error',
      docCount: 0,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkCollection(
  key: string,
  label: string,
  col: string,
  indexedIds: string[]
): Promise<CollectionCheckResult> {
  const start = performance.now();
  try {
    const snap = await getDocsFromServer(collection(db, col));
    const latencyMs = Math.round(performance.now() - start);
    return {
      key,
      label,
      path: col,
      status: snap.size > 0 ? 'synced' : 'empty-default',
      docCount: snap.size,
      latencyMs,
    };
  } catch (err) {
    if (auth.currentUser && indexedIds.length > 0) {
      let count = 0;
      await Promise.all(
        indexedIds.map(async (id) => {
          try {
            const d = await getDocFromServer(doc(db, col, id));
            if (d.exists()) count += 1;
          } catch {
            // Ignore
          }
        })
      );
      return {
        key,
        label,
        path: col,
        status: count > 0 ? 'synced' : 'empty-default',
        docCount: count,
        latencyMs: Math.round(performance.now() - start),
      };
    }
    return {
      key,
      label,
      path: col,
      status: 'error',
      docCount: 0,
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runFullDatabaseAudit(): Promise<DatabaseAuditReport> {
  const auditStart = performance.now();
  const user = auth.currentUser;
  const emailLower = user?.email?.trim().toLowerCase() ?? '';
  const inAllowlist = Boolean(emailLower && ADMIN_EMAIL_ALLOWLIST.has(emailLower));

  if (!user) {
    const probe = await probeFirestoreServerReachable();
    return {
      checkedAt: new Date().toLocaleTimeString(),
      overallConnected: probe.reachable,
      authRequired: true,
      isAuthorizedAdmin: false,
      totalLatencyMs: Math.round(performance.now() - auditStart),
      projectId: FIREBASE_PUBLIC_META.projectId,
      authDomain: FIREBASE_PUBLIC_META.authDomain,
      databaseId: FIREBASE_PUBLIC_META.firestoreDatabaseId,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      isIframe: isRunningInIframe(),
      authState: {
        signedIn: false,
        uid: null,
        email: null,
        emailVerified: false,
        providerIds: [],
        inAllowlist: false,
        adminDocSynced: null,
        adminSyncError: null,
        adminUidDocExists: null,
        adminEmailDocExists: null,
        writeAccessOk: false,
        blockReason: 'not-signed-in',
      },
      collections: PRIVATE_COLLECTIONS.map((item) => ({
        key: item.key,
        label: item.label,
        path: item.path,
        status: probe.reachable ? 'auth-required' : 'error',
        docCount: 0,
        latencyMs: probe.latencyMs,
        ...(probe.reachable ? {} : { error: probe.error }),
      })),
    };
  }

  await user.getIdToken(true).catch(() => undefined);

  let adminUidDocExists = false;
  let adminEmailDocExists = false;
  try {
    const uidSnap = await getDocFromServer(doc(db, 'admins', user.uid));
    adminUidDocExists = uidSnap.exists();
  } catch {
    adminUidDocExists = false;
  }
  if (user.emailVerified && emailLower) {
    try {
      const emailSnap = await getDocFromServer(doc(db, 'admins', emailLower));
      adminEmailDocExists = emailSnap.exists();
    } catch {
      adminEmailDocExists = false;
    }
  }

  const isAuthorizedAdmin = await checkIsAdminUser(user);
  let adminDocSynced: boolean | null = false;
  let adminSyncError: string | null = null;

  if (isAuthorizedAdmin) {
    const syncRes = await syncAdminRecord(user);
    if (syncRes.synced) {
      adminDocSynced = true;
      adminUidDocExists = true;
      await user.getIdToken(true).catch(() => undefined);
    } else {
      adminDocSynced = adminUidDocExists || adminEmailDocExists;
      adminSyncError = syncRes.error ?? 'Failed to write /admins/{uid}.';
    }
  } else {
    const probe = await probeFirestoreServerReachable();
    return {
      checkedAt: new Date().toLocaleTimeString(),
      overallConnected: probe.reachable,
      authRequired: true,
      isAuthorizedAdmin: false,
      totalLatencyMs: Math.round(performance.now() - auditStart),
      projectId: FIREBASE_PUBLIC_META.projectId,
      authDomain: FIREBASE_PUBLIC_META.authDomain,
      databaseId: FIREBASE_PUBLIC_META.firestoreDatabaseId,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
      isIframe: isRunningInIframe(),
      authState: {
        signedIn: true,
        uid: user.uid,
        email: user.email ?? null,
        emailVerified: Boolean(user.emailVerified),
        providerIds: user.providerData?.map((p) => p.providerId) ?? [],
        inAllowlist,
        adminDocSynced: false,
        adminSyncError: null,
        adminUidDocExists,
        adminEmailDocExists,
        writeAccessOk: false,
        blockReason: !user.emailVerified ? 'email-unverified' : 'not-in-admin-list',
      },
      collections: PRIVATE_COLLECTIONS.map((item) => ({
        key: item.key,
        label: item.label,
        path: item.path,
        status: probe.reachable ? 'auth-required' : 'error',
        docCount: 0,
        latencyMs: probe.latencyMs,
        ...(probe.reachable ? {} : { error: probe.error }),
      })),
    };
  }

  let indexWriteOk = false;
  let cvIdx = await readCvIndex();
  if (!cvIdx) {
    try {
      cvIdx = await ensureCvIndex();
      indexWriteOk = true;
    } catch (err) {
      cvIdx = null;
      if (!adminSyncError) {
        adminSyncError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const checkPromises: Array<Promise<CollectionCheckResult>> = [
    checkSingleDoc('profile', 'Profile & Education', 'profile', 'main'),
    checkSingleDoc('cvMedia', 'Portrait Media Asset', 'cvMedia', 'portrait'),
    checkSingleDoc('siteContent', 'UI Copy & Labels', 'siteContent', 'main'),
    checkCollection('experiences', 'Work Experiences', 'experiences', cvIdx?.experienceIds ?? []),
    checkCollection('projects', 'Project Gallery', 'projects', cvIdx?.projectIds ?? []),
    checkCollection('techStacks', 'Technical Skills', 'techStacks', cvIdx?.techStackIds ?? []),
    checkCollection('references', 'References', 'references', cvIdx?.referenceIds ?? []),
    checkSingleDoc('cvIndex', 'Invite & Vault Index', 'cvIndex', 'admin'),
  ];

  if (cvIdx?.vaultKey) {
    checkPromises.push(
      checkSingleDoc('cvShares', 'Global Share Snapshot', 'cvShares', cvIdx.vaultKey)
    );
  }

  const checks = await Promise.all(checkPromises);
  const overallConnected = checks.every((c) => c.status !== 'error');
  const writeAccessOk = Boolean(adminDocSynced || indexWriteOk);

  return {
    checkedAt: new Date().toLocaleTimeString(),
    overallConnected,
    authRequired: false,
    isAuthorizedAdmin: true,
    totalLatencyMs: Math.round(performance.now() - auditStart),
    projectId: FIREBASE_PUBLIC_META.projectId,
    authDomain: FIREBASE_PUBLIC_META.authDomain,
    databaseId: FIREBASE_PUBLIC_META.firestoreDatabaseId,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    isIframe: isRunningInIframe(),
    authState: {
      signedIn: true,
      uid: user.uid,
      email: user.email ?? null,
      emailVerified: Boolean(user.emailVerified),
      providerIds: user.providerData?.map((p) => p.providerId) ?? [],
      inAllowlist,
      adminDocSynced,
      adminSyncError,
      adminUidDocExists,
      adminEmailDocExists,
      writeAccessOk,
      blockReason: null,
    },
    collections: checks,
  };
}

export async function seedMissingDefaultsToFirestore(): Promise<{
  seededCount: number;
}> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required.');
  }

  let seededCount = 0;
  const stepErrors: string[] = [];

  await syncAdminRecord(user);
  const idx = await ensureCvIndex();

  const [profileSnap, siteSnap] = await Promise.all([
    getDocFromServer(doc(db, 'profile', 'main')).catch(() => null),
    getDocFromServer(doc(db, 'siteContent', 'main')).catch(() => null),
  ]);

  if (!profileSnap?.exists()) {
    try {
      await saveProfileToFirestore(DEFAULT_PROFILE_DATA, false);
      seededCount += 1;
    } catch (err) {
      stepErrors.push(`profile/main: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!siteSnap?.exists()) {
    try {
      await saveSiteContentToFirestore(DEFAULT_SITE_CONTENT, false);
      seededCount += 1;
    } catch (err) {
      stepErrors.push(`siteContent/main: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const exp of EXPERIENCES) {
    const existsSnap = await getDocFromServer(doc(db, 'experiences', exp.id)).catch(() => null);
    if (!existsSnap?.exists()) {
      try {
        await saveExperienceToFirestore(exp, false);
        seededCount += 1;
      } catch (err) {
        stepErrors.push(`experiences/${exp.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  for (let i = 0; i < TECH_STACK.length; i += 1) {
    const stack = TECH_STACK[i];
    const existsSnap = await getDocFromServer(doc(db, 'techStacks', stack.id)).catch(() => null);
    if (!existsSnap?.exists()) {
      try {
        await saveTechStackToFirestore({ ...stack, sortOrder: i }, false);
        seededCount += 1;
      } catch (err) {
        stepErrors.push(`techStacks/${stack.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  for (let i = 0; i < REFERENCES.length; i += 1) {
    const ref = REFERENCES[i];
    const refId = `ref_default_${i}`;
    const existsSnap = await getDocFromServer(doc(db, 'references', refId)).catch(() => null);
    if (!existsSnap?.exists()) {
      try {
        await saveReferenceToFirestore(
          {
            id: refId,
            name: ref.name,
            role: ref.role,
            phone: ref.phone,
            sortOrder: i,
          },
          false
        );
        seededCount += 1;
      } catch (err) {
        stepErrors.push(`references/${refId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  try {
    await syncPublishedCvSnapshot(idx.vaultKey);
  } catch (err) {
    stepErrors.push(`cvShares: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (stepErrors.length > 0) {
    throw new Error(stepErrors[0]);
  }

  return { seededCount };
}
