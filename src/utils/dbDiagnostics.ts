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
import { isRunningInIframe, syncAdminRecord } from './projectApi';
import { ensureCvIndex, readCvIndex, syncPublishedCvSnapshot } from './inviteApi';

export interface CollectionCheckResult {
  key: string;
  label: string;
  path: string;
  status: 'synced' | 'empty-default' | 'error';
  docCount: number;
  latencyMs: number;
  error?: string;
}

export interface DatabaseAuditReport {
  checkedAt: string;
  overallConnected: boolean;
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
  };
  collections: CollectionCheckResult[];
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

  const cvIdx = user ? await readCvIndex() : null;

  const checks = await Promise.all([
    checkSingleDoc('profile', 'Profile & Education', 'profile', 'main'),
    checkSingleDoc('siteContent', 'UI Copy & Labels', 'siteContent', 'main'),
    checkCollection('experiences', 'Work Experiences', 'experiences', cvIdx?.experienceIds ?? []),
    checkCollection('projects', 'Project Gallery', 'projects', cvIdx?.projectIds ?? []),
    checkCollection('techStacks', 'Technical Skills', 'techStacks', cvIdx?.techStackIds ?? []),
    checkCollection('references', 'References', 'references', cvIdx?.referenceIds ?? []),
    checkSingleDoc('cvIndex', 'Invite & Vault Index', 'cvIndex', 'admin'),
  ]);

  let adminDocSynced: boolean | null = null;
  if (user) {
    try {
      const uidSnap = await getDocFromServer(doc(db, 'admins', user.uid));
      if (uidSnap.exists()) {
        adminDocSynced = true;
      } else if (user.emailVerified && emailLower) {
        const emailSnap = await getDocFromServer(doc(db, 'admins', emailLower));
        adminDocSynced = emailSnap.exists();
      } else {
        adminDocSynced = false;
      }
    } catch {
      adminDocSynced = false;
    }
  }

  const overallConnected =
    checks.some((c) => c.status !== 'error') && checks.every((c) => c.status !== 'error');

  return {
    checkedAt: new Date().toLocaleTimeString(),
    overallConnected,
    totalLatencyMs: Math.round(performance.now() - auditStart),
    projectId: FIREBASE_PUBLIC_META.projectId,
    authDomain: FIREBASE_PUBLIC_META.authDomain,
    databaseId: FIREBASE_PUBLIC_META.firestoreDatabaseId,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    isIframe: isRunningInIframe(),
    authState: {
      signedIn: Boolean(user),
      uid: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: Boolean(user?.emailVerified),
      providerIds: user?.providerData?.map((p) => p.providerId) ?? [],
      inAllowlist,
      adminDocSynced,
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

  await syncAdminRecord(user);
  const idx = await ensureCvIndex();

  const [profileSnap, siteSnap] = await Promise.all([
    getDocFromServer(doc(db, 'profile', 'main')),
    getDocFromServer(doc(db, 'siteContent', 'main')),
  ]);

  if (!profileSnap.exists()) {
    await saveProfileToFirestore(DEFAULT_PROFILE_DATA, false);
    seededCount += 1;
  }

  if (!siteSnap.exists()) {
    await saveSiteContentToFirestore(DEFAULT_SITE_CONTENT, false);
    seededCount += 1;
  }

  for (const exp of EXPERIENCES) {
    const existsSnap = await getDocFromServer(doc(db, 'experiences', exp.id)).catch(() => null);
    if (!existsSnap?.exists()) {
      await saveExperienceToFirestore(exp, false);
      seededCount += 1;
    }
  }

  for (let i = 0; i < TECH_STACK.length; i += 1) {
    const stack = TECH_STACK[i];
    const existsSnap = await getDocFromServer(doc(db, 'techStacks', stack.id)).catch(() => null);
    if (!existsSnap?.exists()) {
      await saveTechStackToFirestore({ ...stack, sortOrder: i }, false);
      seededCount += 1;
    }
  }

  for (let i = 0; i < REFERENCES.length; i += 1) {
    const ref = REFERENCES[i];
    const refId = `ref_default_${i}`;
    const existsSnap = await getDocFromServer(doc(db, 'references', refId)).catch(() => null);
    if (!existsSnap?.exists()) {
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
    }
  }

  await syncPublishedCvSnapshot(idx.vaultKey);

  return { seededCount };
}
