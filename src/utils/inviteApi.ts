import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  hasValidFirestoreTimestamp,
  isPermissionError,
  OperationType,
} from '../firebase';
import { isValidEmailAddress } from './safeUrls';
import type {
  ExperienceItem,
  ExperienceStatus,
  TechCategory,
} from '../data/cvData';
import type {
  SiteCopyLocale,
  CvProfileData,
  EducationData,
  FirestoreReferenceItem,
  FirestoreTechCategory,
  MetricItem,
  SiteContentData,
} from './cvFirestoreApi';
import { parseCareerStages, type FirestoreExperienceItem } from './experienceApi';
import type { ProjectCategory, ProjectPhotoItem } from './projectApi';

export interface InviteRecord {
  token: string;
  label: string;
  active: boolean;
  expiresAtMs: number | null;
  vaultKey: string;
  createdByEmail: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ResolvedInviteSession {
  token: string;
  vaultKey: string;
  label: string;
  expiresAtMs: number | null;
  profile: CvProfileData;
  siteContent: SiteContentData;
  experiences: FirestoreExperienceItem[];
  projects: ProjectPhotoItem[];
  techStacks: FirestoreTechCategory[];
  references: FirestoreReferenceItem[];
}

export interface GlobalSyncState {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedAt: number | null;
  error: string | null;
}

interface CvIndexDoc {
  vaultKey: string;
  experienceIds: string[];
  projectIds: string[];
  techStackIds: string[];
  referenceIds: string[];
  inviteTokens: string[];
}

interface SharedProjectMeta {
  id: string;
  title: string;
  property: string;
  year: string;
  category: ProjectCategory;
  description: string;
  createdAtMs: number;
}

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;
const VAULT_KEY_PATTERN = /^[a-zA-Z0-9_-]{24,64}$/;
const VALID_PROJECT_CATS = new Set<ProjectCategory>([
  'infrastructure',
  'pms-pos',
  'security',
  'event-av',
]);
const VALID_EXP_STATUS = new Set<ExperienceStatus>(['active', 'completed']);
const VALID_TECH_GROUPS = new Set<TechCategory['group']>([
  'core',
  'infra',
  'guest',
  'productivity',
]);

let snapshotSyncTimer: number | null = null;
let globalSyncState: GlobalSyncState = {
  status: 'idle',
  lastSyncedAt: null,
  error: null,
};
const syncListeners = new Set<(state: GlobalSyncState) => void>();

function emitGlobalSyncState(next: GlobalSyncState): void {
  globalSyncState = next;
  syncListeners.forEach((listener) => {
    try {
      listener(globalSyncState);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribeGlobalSyncStatus(
  listener: (state: GlobalSyncState) => void
): () => void {
  syncListeners.add(listener);
  listener(globalSyncState);
  return () => {
    syncListeners.delete(listener);
  };
}

function randomTokenString(length: number, prefix = ''): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let body = '';
  for (let i = 0; i < length; i += 1) {
    body += alphabet[bytes[i] % alphabet.length];
  }
  return prefix ? `${prefix}${body}` : body;
}

export function generateRandomVaultKey(): string {
  return randomTokenString(32);
}

export function generateRandomInviteCode(): string {
  return randomTokenString(12, 'hrd-');
}

export function normalizeInviteCode(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/[^/]+\/?\??/i, '')
    .replace(/^invite=/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function toMillis(val: unknown): number | null {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return null;
}

export async function readCvIndex(): Promise<CvIndexDoc | null> {
  const ref = doc(db, 'cvIndex', 'admin');
  try {
    const snap = await getDocFromServer(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      vaultKey: typeof d.vaultKey === 'string' ? d.vaultKey : '',
      experienceIds: Array.isArray(d.experienceIds)
        ? d.experienceIds.filter((x): x is string => typeof x === 'string')
        : [],
      projectIds: Array.isArray(d.projectIds)
        ? d.projectIds.filter((x): x is string => typeof x === 'string')
        : [],
      techStackIds: Array.isArray(d.techStackIds)
        ? d.techStackIds.filter((x): x is string => typeof x === 'string')
        : [],
      referenceIds: Array.isArray(d.referenceIds)
        ? d.referenceIds.filter((x): x is string => typeof x === 'string')
        : [],
      inviteTokens: Array.isArray(d.inviteTokens)
        ? d.inviteTokens.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

async function discoverAdminCollectionIds(
  colName: string,
  fallbackIds: string[]
): Promise<string[]> {
  try {
    const snap = await getDocsFromServer(collection(db, colName));
    const discovered = snap.docs.map((d) => d.id);
    return Array.from(new Set([...fallbackIds, ...discovered])).slice(0, 60);
  } catch {
    return fallbackIds.slice(0, 60);
  }
}

async function runInviteAdminRetry<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (err) {
    const user = auth.currentUser;
    if (user && isPermissionError(err)) {
      await user.getIdToken(true).catch(() => undefined);
      const { syncAdminRecord } = await import('./projectApi');
      await syncAdminRecord(user).catch(() => undefined);
      await user.getIdToken(true).catch(() => undefined);
      return await task();
    }
    throw err;
  }
}

export async function ensureCvIndex(): Promise<CvIndexDoc> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');

  const indexRef = doc(db, 'cvIndex', 'admin');
  const existingSnap = await runInviteAdminRetry(() => getDocFromServer(indexRef));
  const existingRaw = existingSnap.exists() ? existingSnap.data() : null;
  const existing: CvIndexDoc | null = existingRaw
    ? {
        vaultKey: typeof existingRaw.vaultKey === 'string' ? existingRaw.vaultKey : '',
        experienceIds: Array.isArray(existingRaw.experienceIds)
          ? existingRaw.experienceIds.filter((x): x is string => typeof x === 'string')
          : [],
        projectIds: Array.isArray(existingRaw.projectIds)
          ? existingRaw.projectIds.filter((x): x is string => typeof x === 'string')
          : [],
        techStackIds: Array.isArray(existingRaw.techStackIds)
          ? existingRaw.techStackIds.filter((x): x is string => typeof x === 'string')
          : [],
        referenceIds: Array.isArray(existingRaw.referenceIds)
          ? existingRaw.referenceIds.filter((x): x is string => typeof x === 'string')
          : [],
        inviteTokens: Array.isArray(existingRaw.inviteTokens)
          ? existingRaw.inviteTokens.filter((x): x is string => typeof x === 'string')
          : [],
      }
    : null;

  if (existing && VAULT_KEY_PATTERN.test(existing.vaultKey)) {
    return existing;
  }

  const { EXPERIENCES, TECH_STACK, REFERENCES } = await import('../data/cvData');
  const defaultExpIds = EXPERIENCES.map((e) => e.id);
  const defaultStackIds = TECH_STACK.map((t) => t.id);
  const defaultRefIds = REFERENCES.map((_, i) => `ref_default_${i}`);

  const [expIds, projIds, stackIds, refIds] = await Promise.all([
    discoverAdminCollectionIds('experiences', defaultExpIds),
    discoverAdminCollectionIds('projects', []),
    discoverAdminCollectionIds('techStacks', defaultStackIds),
    discoverAdminCollectionIds('references', defaultRefIds),
  ]);

  const initial: CvIndexDoc = {
    vaultKey:
      existing?.vaultKey && VAULT_KEY_PATTERN.test(existing.vaultKey)
        ? existing.vaultKey
        : generateRandomVaultKey(),
    experienceIds: expIds,
    projectIds: projIds,
    techStackIds: stackIds,
    referenceIds: refIds,
    inviteTokens: existing?.inviteTokens ?? [],
  };

  const preservedAuthorId =
    typeof existingRaw?.authorId === 'string' && existingRaw.authorId.length > 0
      ? existingRaw.authorId
      : user.uid;
  const preservedCreatedAt =
    existingRaw && hasValidFirestoreTimestamp(existingRaw.createdAt)
      ? existingRaw.createdAt
      : serverTimestamp();

  await runInviteAdminRetry(() =>
    setDoc(indexRef, {
      ...initial,
      authorId: preservedAuthorId,
      createdAt: preservedCreatedAt,
      updatedAt: serverTimestamp(),
    })
  );

  return initial;
}

export async function registerEntityInCvIndex(
  field: 'experienceIds' | 'projectIds' | 'techStackIds' | 'referenceIds' | 'inviteTokens',
  id: string,
  mode: 'add' | 'remove'
): Promise<void> {
  if (!auth.currentUser) return;
  const user = auth.currentUser;
  try {
    const index = await ensureCvIndex();
    const indexRef = doc(db, 'cvIndex', 'admin');
    await runInviteAdminRetry(async () => {
      const snap = await getDocFromServer(indexRef).catch(() => null);
      const existing = snap?.exists() ? snap.data() : null;
      const current = index[field];
      const next =
        mode === 'add'
          ? Array.from(new Set([...current, id])).slice(0, field === 'inviteTokens' ? 100 : 60)
          : current.filter((item) => item !== id);

      await setDoc(indexRef, {
        ...index,
        [field]: next,
        authorId:
          typeof existing?.authorId === 'string' && existing.authorId.length > 0
            ? existing.authorId
            : user.uid,
        createdAt:
          existing && hasValidFirestoreTimestamp(existing.createdAt)
            ? existing.createdAt
            : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    console.warn('cvIndex sync warning:', err);
  }
}

async function fetchAdminDocsByIds(
  colName: string,
  ids: string[]
): Promise<{ id: string; data: Record<string, unknown> }[]> {
  try {
    const snap = await getDocsFromServer(
      query(
        collection(db, colName),
        orderBy(colName === 'projects' ? 'createdAt' : 'sortOrder', 'asc')
      )
    );
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
  } catch {
    const results: { id: string; data: Record<string, unknown> }[] = [];
    const uniqueIds = Array.from(new Set(ids));
    await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const d = await getDocFromServer(doc(db, colName, id));
          if (d.exists()) {
            results.push({ id: d.id, data: d.data() as Record<string, unknown> });
          }
        } catch {
          // Ignore individual missing doc
        }
      })
    );
    return results;
  }
}

export async function syncPublishedCvSnapshot(targetVaultKey?: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');

  emitGlobalSyncState({ ...globalSyncState, status: 'syncing', error: null });
  try {
    const index = await ensureCvIndex();
    const vaultKey = targetVaultKey && VAULT_KEY_PATTERN.test(targetVaultKey)
      ? targetVaultKey
      : index.vaultKey;

    const [
      { DEFAULT_PROFILE_DATA, DEFAULT_SITE_CONTENT },
      { EXPERIENCES, TECH_STACK, REFERENCES },
    ] = await Promise.all([
      import('./cvFirestoreApi'),
      import('../data/cvData'),
    ]);

    const [profileSnap, siteSnap, expDocs, stackDocs, refDocs, projDocs] = await Promise.all([
      getDocFromServer(doc(db, 'profile', 'main')).catch(() => null),
      getDocFromServer(doc(db, 'siteContent', 'main')).catch(() => null),
      fetchAdminDocsByIds('experiences', index.experienceIds),
      fetchAdminDocsByIds('techStacks', index.techStackIds),
      fetchAdminDocsByIds('references', index.referenceIds),
      fetchAdminDocsByIds('projects', index.projectIds),
    ]);

    const rawProfile = profileSnap?.exists() ? profileSnap.data() : null;
    const profilePayload = rawProfile
      ? {
          name: rawProfile.name ?? DEFAULT_PROFILE_DATA.name,
          brandShort: rawProfile.brandShort ?? DEFAULT_PROFILE_DATA.brandShort,
          titleEn: rawProfile.titleEn ?? DEFAULT_PROFILE_DATA.titleEn,
          titleId: rawProfile.titleId ?? DEFAULT_PROFILE_DATA.titleId,
          kickerEn: rawProfile.kickerEn ?? DEFAULT_PROFILE_DATA.kickerEn,
          kickerId: rawProfile.kickerId ?? DEFAULT_PROFILE_DATA.kickerId,
          currentCompany: rawProfile.currentCompany ?? DEFAULT_PROFILE_DATA.currentCompany,
          currentRole: rawProfile.currentRole ?? DEFAULT_PROFILE_DATA.currentRole,
          summaryEn: rawProfile.summaryEn ?? DEFAULT_PROFILE_DATA.summaryEn,
          summaryId: rawProfile.summaryId ?? DEFAULT_PROFILE_DATA.summaryId,
          phoneDisplay: rawProfile.phoneDisplay ?? DEFAULT_PROFILE_DATA.phoneDisplay,
          whatsappHref: rawProfile.whatsappHref ?? DEFAULT_PROFILE_DATA.whatsappHref,
          email: rawProfile.email ?? DEFAULT_PROFILE_DATA.email,
          address: rawProfile.address ?? DEFAULT_PROFILE_DATA.address,
          portraitDataUrl: rawProfile.portraitDataUrl ?? DEFAULT_PROFILE_DATA.portraitDataUrl,
          metrics: Array.isArray(rawProfile.metrics) ? rawProfile.metrics : DEFAULT_PROFILE_DATA.metrics,
          education:
            typeof rawProfile.education === 'object' && rawProfile.education !== null
              ? rawProfile.education
              : DEFAULT_PROFILE_DATA.education,
        }
      : {
          name: DEFAULT_PROFILE_DATA.name,
          brandShort: DEFAULT_PROFILE_DATA.brandShort,
          titleEn: DEFAULT_PROFILE_DATA.titleEn,
          titleId: DEFAULT_PROFILE_DATA.titleId,
          kickerEn: DEFAULT_PROFILE_DATA.kickerEn,
          kickerId: DEFAULT_PROFILE_DATA.kickerId,
          currentCompany: DEFAULT_PROFILE_DATA.currentCompany,
          currentRole: DEFAULT_PROFILE_DATA.currentRole,
          summaryEn: DEFAULT_PROFILE_DATA.summaryEn,
          summaryId: DEFAULT_PROFILE_DATA.summaryId,
          phoneDisplay: DEFAULT_PROFILE_DATA.phoneDisplay,
          whatsappHref: DEFAULT_PROFILE_DATA.whatsappHref,
          email: DEFAULT_PROFILE_DATA.email,
          address: DEFAULT_PROFILE_DATA.address,
          portraitDataUrl: DEFAULT_PROFILE_DATA.portraitDataUrl,
          metrics: DEFAULT_PROFILE_DATA.metrics,
          education: DEFAULT_PROFILE_DATA.education,
        };

    const rawSite = siteSnap?.exists() ? siteSnap.data() : null;
    const sitePayload = rawSite
      ? { en: rawSite.en ?? DEFAULT_SITE_CONTENT.en, id: rawSite.id ?? DEFAULT_SITE_CONTENT.id }
      : { en: DEFAULT_SITE_CONTENT.en, id: DEFAULT_SITE_CONTENT.id };

    const expMap = new Map<string, ExperienceItem>();
    EXPERIENCES.forEach((e) => expMap.set(e.id, e));
    expDocs.forEach(({ id, data }) => {
      const stages = parseCareerStages(data.careerStages);
      expMap.set(id, {
        id,
        company: String(data.company ?? ''),
        role: String(data.role ?? ''),
        roleId: String(data.roleId ?? data.role ?? ''),
        status: VALID_EXP_STATUS.has(data.status as ExperienceStatus)
          ? (data.status as ExperienceStatus)
          : 'completed',
        category: data.category === 'leadership' ? 'leadership' : 'operations',
        period: String(data.period ?? ''),
        periodId: String(data.periodId ?? data.period ?? ''),
        scaleContext: String(data.scaleContext ?? ''),
        scaleContextId: String(data.scaleContextId ?? data.scaleContext ?? ''),
        bullets: Array.isArray(data.bullets) ? data.bullets.map(String) : [],
        bulletsId: Array.isArray(data.bulletsId) ? data.bulletsId.map(String) : [],
        systems: Array.isArray(data.systems) ? data.systems.map(String) : [],
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 99,
        ...(stages ? { careerStages: stages } : {}),
      });
    });

    const stackMap = new Map<string, TechCategory & { sortOrder: number }>();
    TECH_STACK.forEach((s, idx) => stackMap.set(s.id, { ...s, sortOrder: idx }));
    stackDocs.forEach(({ id, data }) => {
      stackMap.set(id, {
        id,
        group: VALID_TECH_GROUPS.has(data.group as TechCategory['group'])
          ? (data.group as TechCategory['group'])
          : 'core',
        label: String(data.label ?? ''),
        labelId: String(data.labelId ?? data.label ?? ''),
        items: Array.isArray(data.items) ? data.items.map(String) : [],
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 99,
      });
    });

    const refMap = new Map<string, { id: string; name: string; role: string; phone: string; sortOrder: number }>();
    REFERENCES.forEach((r, idx) =>
      refMap.set(`ref_default_${idx}`, {
        id: `ref_default_${idx}`,
        name: r.name,
        role: r.role,
        phone: r.phone,
        sortOrder: idx,
      })
    );
    refDocs.forEach(({ id, data }) => {
      refMap.set(id, {
        id,
        name: String(data.name ?? ''),
        role: String(data.role ?? ''),
        phone: String(data.phone ?? ''),
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 99,
      });
    });

    const projectMeta: SharedProjectMeta[] = [];
    await Promise.all(
      projDocs.slice(0, 60).map(async ({ id, data }) => {
        const imageDataUrl = typeof data.imageDataUrl === 'string' ? data.imageDataUrl : '';
        if (!imageDataUrl) return;
        projectMeta.push({
          id,
          title: String(data.title ?? ''),
          property: String(data.property ?? ''),
          year: String(data.year ?? ''),
          category: VALID_PROJECT_CATS.has(data.category as ProjectCategory)
            ? (data.category as ProjectCategory)
            : 'infrastructure',
          description: String(data.description ?? ''),
          createdAtMs: toMillis(data.createdAt) ?? Date.now(),
        });

        const assetId = `${vaultKey}__${id}`;
        const assetRef = doc(db, 'cvProjectAssets', assetId);
        await runInviteAdminRetry(async () => {
          const assetSnap = await getDocFromServer(assetRef).catch(() => null);
          const assetExisting = assetSnap?.exists() ? assetSnap.data() : null;
          await setDoc(assetRef, {
            projectId: id,
            imageDataUrl,
            authorId:
              typeof assetExisting?.authorId === 'string' && assetExisting.authorId.length > 0
                ? assetExisting.authorId
                : user.uid,
            createdAt:
              assetExisting && hasValidFirestoreTimestamp(assetExisting.createdAt)
                ? assetExisting.createdAt
                : serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      })
    );

    const shareRef = doc(db, 'cvShares', vaultKey);
    const shareData = {
      profile: profilePayload,
      siteContent: sitePayload,
      experiences: Array.from(expMap.values()).sort((a, b) => a.sortOrder - b.sortOrder),
      techStacks: Array.from(stackMap.values()).sort((a, b) => a.sortOrder - b.sortOrder),
      references: Array.from(refMap.values()).sort((a, b) => a.sortOrder - b.sortOrder),
      projectMeta: projectMeta.sort((a, b) => a.createdAtMs - b.createdAtMs),
    };

    await runInviteAdminRetry(async () => {
      const shareSnap = await getDocFromServer(shareRef).catch(() => null);
      const shareExisting = shareSnap?.exists() ? shareSnap.data() : null;
      await setDoc(shareRef, {
        ...shareData,
        authorId:
          typeof shareExisting?.authorId === 'string' && shareExisting.authorId.length > 0
            ? shareExisting.authorId
            : user.uid,
        createdAt:
          shareExisting && hasValidFirestoreTimestamp(shareExisting.createdAt)
            ? shareExisting.createdAt
            : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const indexRef = doc(db, 'cvIndex', 'admin');
    await runInviteAdminRetry(async () => {
      const indexSnap = await getDocFromServer(indexRef).catch(() => null);
      const indexExisting = indexSnap?.exists() ? indexSnap.data() : null;
      await setDoc(indexRef, {
        vaultKey: index.vaultKey,
        experienceIds: Array.from(expMap.keys()).slice(0, 60),
        projectIds: projectMeta.map((p) => p.id).slice(0, 60),
        techStackIds: Array.from(stackMap.keys()).slice(0, 60),
        referenceIds: Array.from(refMap.keys()).slice(0, 60),
        inviteTokens: index.inviteTokens,
        authorId:
          typeof indexExisting?.authorId === 'string' && indexExisting.authorId.length > 0
            ? indexExisting.authorId
            : user.uid,
        createdAt:
          indexExisting && hasValidFirestoreTimestamp(indexExisting.createdAt)
            ? indexExisting.createdAt
            : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }).catch(() => undefined);

    emitGlobalSyncState({
      status: 'synced',
      lastSyncedAt: Date.now(),
      error: null,
    });
    return vaultKey;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitGlobalSyncState({
      ...globalSyncState,
      status: 'error',
      error: msg,
    });
    throw err;
  }
}

export function schedulePublishedSnapshotSync(): void {
  if (!auth.currentUser || typeof window === 'undefined') return;
  emitGlobalSyncState({ ...globalSyncState, status: 'syncing', error: null });
  if (snapshotSyncTimer !== null) {
    window.clearTimeout(snapshotSyncTimer);
  }
  snapshotSyncTimer = window.setTimeout(() => {
    snapshotSyncTimer = null;
    void ensureCvIndex()
      .then((idx) => syncPublishedCvSnapshot(idx.vaultKey))
      .catch((err) => {
        console.warn('Background share sync warning:', err);
      });
  }, 150);
}

export async function listAdminInvites(): Promise<{
  invites: InviteRecord[];
  vaultKey: string;
}> {
  const index = await ensureCvIndex();
  const invites: InviteRecord[] = [];

  await Promise.all(
    index.inviteTokens.map(async (token) => {
      try {
        const snap = await getDocFromServer(doc(db, 'invites', token));
        if (!snap.exists()) return;
        const d = snap.data();
        invites.push({
          token: snap.id,
          label: typeof d.label === 'string' ? d.label : snap.id,
          active: Boolean(d.active),
          expiresAtMs: toMillis(d.expiresAt),
          vaultKey: typeof d.vaultKey === 'string' ? d.vaultKey : index.vaultKey,
          createdByEmail: typeof d.createdByEmail === 'string' ? d.createdByEmail : '',
          createdAtMs: toMillis(d.createdAt) ?? Date.now(),
          updatedAtMs: toMillis(d.updatedAt) ?? Date.now(),
        });
      } catch {
        // Ignore missing/deleted tokens
      }
    })
  );

  invites.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return { invites, vaultKey: index.vaultKey };
}

export async function createInviteLink(params: {
  label: string;
  customCode?: string;
  expiresInDays: number | null;
}): Promise<InviteRecord> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');

  const cleanLabel = params.label.trim().slice(0, 120);
  if (!cleanLabel) {
    throw new Error('Nama / tujuan undangan wajib diisi (mis. HRD Hotel Mulia).');
  }

  const rawToken = params.customCode?.trim()
    ? normalizeInviteCode(params.customCode)
    : generateRandomInviteCode();

  if (!TOKEN_PATTERN.test(rawToken)) {
    throw new Error(
      'Kode undangan harus 6–64 karakter huruf, angka, tanda hubung (-), atau garis bawah (_).'
    );
  }

  const existingSnap = await getDocFromServer(doc(db, 'invites', rawToken));
  if (existingSnap.exists()) {
    throw new Error(`Kode "${rawToken}" sudah dipakai. Gunakan kode lain.`);
  }

  const index = await ensureCvIndex();
  await syncPublishedCvSnapshot(index.vaultKey);

  const expiresAtTs =
    params.expiresInDays !== null && params.expiresInDays > 0
      ? Timestamp.fromMillis(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  const fallbackEmail =
    user.email && isValidEmailAddress(user.email.trim())
      ? user.email.trim().toLowerCase()
      : 'admin@cv-junianto.vercel.app';

  try {
    await runInviteAdminRetry(() =>
      setDoc(doc(db, 'invites', rawToken), {
        label: cleanLabel,
        active: true,
        expiresAt: expiresAtTs,
        vaultKey: index.vaultKey,
        createdByEmail: fallbackEmail,
        authorId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await registerEntityInCvIndex('inviteTokens', rawToken, 'add');
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `invites/${rawToken}`);
  }

  return {
    token: rawToken,
    label: cleanLabel,
    active: true,
    expiresAtMs: expiresAtTs ? expiresAtTs.toMillis() : null,
    vaultKey: index.vaultKey,
    createdByEmail: fallbackEmail,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };
}

export async function toggleInviteActive(token: string, active: boolean): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');
  const fallbackEmail =
    user.email && isValidEmailAddress(user.email.trim())
      ? user.email.trim().toLowerCase()
      : 'admin@cv-junianto.vercel.app';
  try {
    await runInviteAdminRetry(async () => {
      const invRef = doc(db, 'invites', token);
      const snap = await getDocFromServer(invRef);
      if (!snap.exists()) throw new Error('Invite not found.');
      const existing = snap.data();
      const createdByEmail =
        typeof existing.createdByEmail === 'string' &&
        isValidEmailAddress(existing.createdByEmail.trim())
          ? existing.createdByEmail.trim().toLowerCase()
          : fallbackEmail;
      await setDoc(invRef, {
        label: typeof existing.label === 'string' && existing.label.trim() ? existing.label.trim() : token,
        active,
        expiresAt: existing.expiresAt ?? null,
        vaultKey: typeof existing.vaultKey === 'string' ? existing.vaultKey : '',
        createdByEmail,
        authorId:
          typeof existing.authorId === 'string' && existing.authorId.length > 0
            ? existing.authorId
            : user.uid,
        createdAt: hasValidFirestoreTimestamp(existing.createdAt)
          ? existing.createdAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `invites/${token}`);
  }
}

export async function updateInviteExpiry(
  token: string,
  expiresInDays: number | null
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');
  const expiresAtTs =
    expiresInDays !== null && expiresInDays > 0
      ? Timestamp.fromMillis(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;
  const fallbackEmail =
    user.email && isValidEmailAddress(user.email.trim())
      ? user.email.trim().toLowerCase()
      : 'admin@cv-junianto.vercel.app';
  try {
    await runInviteAdminRetry(async () => {
      const invRef = doc(db, 'invites', token);
      const snap = await getDocFromServer(invRef);
      if (!snap.exists()) throw new Error('Invite not found.');
      const existing = snap.data();
      const createdByEmail =
        typeof existing.createdByEmail === 'string' &&
        isValidEmailAddress(existing.createdByEmail.trim())
          ? existing.createdByEmail.trim().toLowerCase()
          : fallbackEmail;
      await setDoc(invRef, {
        label: typeof existing.label === 'string' && existing.label.trim() ? existing.label.trim() : token,
        active: Boolean(existing.active),
        expiresAt: expiresAtTs,
        vaultKey: typeof existing.vaultKey === 'string' ? existing.vaultKey : '',
        createdByEmail,
        authorId:
          typeof existing.authorId === 'string' && existing.authorId.length > 0
            ? existing.authorId
            : user.uid,
        createdAt: hasValidFirestoreTimestamp(existing.createdAt)
          ? existing.createdAt
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `invites/${token}`);
  }
}

export async function deleteInviteLink(token: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentication required.');
  try {
    await runInviteAdminRetry(() => deleteDoc(doc(db, 'invites', token)));
    await registerEntityInCvIndex('inviteTokens', token, 'remove');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invites/${token}`);
  }
}

export async function rotateShareVaultKey(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');

  const index = await ensureCvIndex();
  const oldKey = index.vaultKey;
  const newKey = generateRandomVaultKey();
  const fallbackEmail =
    user.email && isValidEmailAddress(user.email.trim())
      ? user.email.trim().toLowerCase()
      : 'admin@cv-junianto.vercel.app';

  await syncPublishedCvSnapshot(newKey);

  const indexRef = doc(db, 'cvIndex', 'admin');
  await runInviteAdminRetry(async () => {
    const indexSnap = await getDocFromServer(indexRef).catch(() => null);
    const indexExisting = indexSnap?.exists() ? indexSnap.data() : null;
    await setDoc(indexRef, {
      ...index,
      vaultKey: newKey,
      authorId:
        typeof indexExisting?.authorId === 'string' && indexExisting.authorId.length > 0
          ? indexExisting.authorId
          : user.uid,
      createdAt:
        indexExisting && hasValidFirestoreTimestamp(indexExisting.createdAt)
          ? indexExisting.createdAt
          : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await Promise.all(
    index.inviteTokens.map(async (token) => {
      try {
        await runInviteAdminRetry(async () => {
          const invRef = doc(db, 'invites', token);
          const invSnap = await getDocFromServer(invRef);
          if (!invSnap.exists()) return;
          const ex = invSnap.data();
          const createdByEmail =
            typeof ex.createdByEmail === 'string' &&
            isValidEmailAddress(ex.createdByEmail.trim())
              ? ex.createdByEmail.trim().toLowerCase()
              : fallbackEmail;
          await setDoc(invRef, {
            label: typeof ex.label === 'string' && ex.label.trim() ? ex.label.trim() : token,
            active: Boolean(ex.active),
            expiresAt: ex.expiresAt ?? null,
            vaultKey: newKey,
            createdByEmail,
            authorId:
              typeof ex.authorId === 'string' && ex.authorId.length > 0 ? ex.authorId : user.uid,
            createdAt: hasValidFirestoreTimestamp(ex.createdAt)
              ? ex.createdAt
              : serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      } catch {
        // Ignore stale token
      }
    })
  );

  if (oldKey && oldKey !== newKey && VAULT_KEY_PATTERN.test(oldKey)) {
    await deleteDoc(doc(db, 'cvShares', oldKey)).catch(() => undefined);
    await Promise.all(
      index.projectIds.map((pid) =>
        deleteDoc(doc(db, 'cvProjectAssets', `${oldKey}__${pid}`)).catch(() => undefined)
      )
    );
  }

  return newKey;
}

export async function resolveInviteToken(
  rawToken: string
): Promise<ResolvedInviteSession> {
  const token = normalizeInviteCode(rawToken);
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error('INVITE_INVALID_OR_EXPIRED');
  }

  let inviteSnap;
  try {
    inviteSnap = await getDocFromServer(doc(db, 'invites', token));
  } catch {
    throw new Error('INVITE_INVALID_OR_EXPIRED');
  }

  if (!inviteSnap.exists()) {
    throw new Error('INVITE_INVALID_OR_EXPIRED');
  }

  const invData = inviteSnap.data();
  const vaultKey = typeof invData.vaultKey === 'string' ? invData.vaultKey : '';
  const active = Boolean(invData.active);
  const expiresAtMs = toMillis(invData.expiresAt);

  if (!active || (expiresAtMs !== null && expiresAtMs <= Date.now())) {
    throw new Error('INVITE_INVALID_OR_EXPIRED');
  }
  if (!VAULT_KEY_PATTERN.test(vaultKey)) {
    throw new Error('INVITE_INVALID_OR_EXPIRED');
  }

  let shareSnap;
  try {
    shareSnap = await getDocFromServer(doc(db, 'cvShares', vaultKey));
  } catch {
    throw new Error('INVITE_SNAPSHOT_MISSING');
  }

  if (!shareSnap.exists()) {
    throw new Error('INVITE_SNAPSHOT_MISSING');
  }

  const sd = shareSnap.data();
  const [{ DEFAULT_PROFILE_DATA, DEFAULT_SITE_CONTENT }] = await Promise.all([
    import('./cvFirestoreApi'),
  ]);

  return parseShareBundleIntoSession({
    token,
    vaultKey,
    label: typeof invData.label === 'string' ? invData.label : token,
    expiresAtMs,
    sd,
    DEFAULT_PROFILE_DATA,
    DEFAULT_SITE_CONTENT,
  });
}

async function parseShareBundleIntoSession(params: {
  token: string;
  vaultKey: string;
  label: string;
  expiresAtMs: number | null;
  sd: Record<string, unknown>;
  DEFAULT_PROFILE_DATA: CvProfileData;
  DEFAULT_SITE_CONTENT: SiteContentData;
}): Promise<ResolvedInviteSession> {
  const { token, vaultKey, label, expiresAtMs, sd, DEFAULT_PROFILE_DATA, DEFAULT_SITE_CONTENT } = params;

  const rawProfile = (typeof sd.profile === 'object' && sd.profile !== null
    ? sd.profile
    : {}) as Partial<CvProfileData>;
  const rawEdu = (typeof rawProfile.education === 'object' && rawProfile.education !== null
    ? rawProfile.education
    : {}) as Partial<EducationData>;

  const profile: CvProfileData = {
    name: typeof rawProfile.name === 'string' ? rawProfile.name : DEFAULT_PROFILE_DATA.name,
    brandShort:
      typeof rawProfile.brandShort === 'string'
        ? rawProfile.brandShort
        : DEFAULT_PROFILE_DATA.brandShort,
    titleEn:
      typeof rawProfile.titleEn === 'string'
        ? rawProfile.titleEn
        : DEFAULT_PROFILE_DATA.titleEn,
    titleId:
      typeof rawProfile.titleId === 'string'
        ? rawProfile.titleId
        : DEFAULT_PROFILE_DATA.titleId,
    kickerEn:
      typeof rawProfile.kickerEn === 'string'
        ? rawProfile.kickerEn.replace(/Harvard-Standard Curriculum Vitae/gi, 'Executive Curriculum Vitae')
        : DEFAULT_PROFILE_DATA.kickerEn,
    kickerId:
      typeof rawProfile.kickerId === 'string'
        ? rawProfile.kickerId.replace(/Curriculum Vitae Standar Harvard/gi, 'Curriculum Vitae Profesional')
        : DEFAULT_PROFILE_DATA.kickerId,
    currentCompany:
      typeof rawProfile.currentCompany === 'string'
        ? rawProfile.currentCompany
        : DEFAULT_PROFILE_DATA.currentCompany,
    currentRole:
      typeof rawProfile.currentRole === 'string'
        ? rawProfile.currentRole
        : DEFAULT_PROFILE_DATA.currentRole,
    summaryEn:
      typeof rawProfile.summaryEn === 'string'
        ? rawProfile.summaryEn
        : DEFAULT_PROFILE_DATA.summaryEn,
    summaryId:
      typeof rawProfile.summaryId === 'string'
        ? rawProfile.summaryId
        : DEFAULT_PROFILE_DATA.summaryId,
    phoneDisplay:
      typeof rawProfile.phoneDisplay === 'string'
        ? rawProfile.phoneDisplay
        : DEFAULT_PROFILE_DATA.phoneDisplay,
    whatsappHref:
      typeof rawProfile.whatsappHref === 'string'
        ? rawProfile.whatsappHref
        : DEFAULT_PROFILE_DATA.whatsappHref,
    email: typeof rawProfile.email === 'string' ? rawProfile.email : DEFAULT_PROFILE_DATA.email,
    address:
      typeof rawProfile.address === 'string'
        ? rawProfile.address
        : DEFAULT_PROFILE_DATA.address,
    portraitDataUrl:
      typeof rawProfile.portraitDataUrl === 'string'
        ? rawProfile.portraitDataUrl
        : DEFAULT_PROFILE_DATA.portraitDataUrl,
    metrics:
      Array.isArray(rawProfile.metrics) && rawProfile.metrics.length > 0
        ? (rawProfile.metrics as MetricItem[])
        : DEFAULT_PROFILE_DATA.metrics,
    education: {
      institution:
        typeof rawEdu.institution === 'string'
          ? rawEdu.institution
          : DEFAULT_PROFILE_DATA.education.institution,
      majorEn:
        typeof rawEdu.majorEn === 'string'
          ? rawEdu.majorEn
          : DEFAULT_PROFILE_DATA.education.majorEn,
      majorId:
        typeof rawEdu.majorId === 'string'
          ? rawEdu.majorId
          : DEFAULT_PROFILE_DATA.education.majorId,
      period:
        typeof rawEdu.period === 'string'
          ? rawEdu.period
          : DEFAULT_PROFILE_DATA.education.period,
      gpaEn:
        typeof rawEdu.gpaEn === 'string'
          ? rawEdu.gpaEn
          : DEFAULT_PROFILE_DATA.education.gpaEn,
      gpaId:
        typeof rawEdu.gpaId === 'string'
          ? rawEdu.gpaId
          : DEFAULT_PROFILE_DATA.education.gpaId,
      focusEn:
        typeof rawEdu.focusEn === 'string'
          ? rawEdu.focusEn
          : DEFAULT_PROFILE_DATA.education.focusEn,
      focusId:
        typeof rawEdu.focusId === 'string'
          ? rawEdu.focusId
          : DEFAULT_PROFILE_DATA.education.focusId,
    },
    fromFirestore: true,
  };

  const rawSite = (typeof sd.siteContent === 'object' && sd.siteContent !== null
    ? sd.siteContent
    : {}) as Partial<SiteContentData>;
  const normalizeCopyLocale = (
    loc: Partial<SiteCopyLocale> | undefined,
    fallback: SiteCopyLocale
  ): SiteCopyLocale => {
    const merged = { ...fallback, ...(loc ?? {}) };
    if (/harvard/i.test(merged.downloadPdf)) {
      merged.downloadPdf = /cetak|simpan|unduh/i.test(merged.downloadPdf)
        ? 'Unduh PDF'
        : 'Download PDF';
    }
    if (/harvard/i.test(merged.heroDossierFooter)) {
      merged.heroDossierFooter = /siap cetak/i.test(merged.heroDossierFooter)
        ? 'Siap Cetak Format A4'
        : 'A4 Executive Print Ready';
    }
    return merged;
  };
  const siteContent: SiteContentData = {
    en: normalizeCopyLocale(rawSite.en, DEFAULT_SITE_CONTENT.en),
    id: normalizeCopyLocale(rawSite.id, DEFAULT_SITE_CONTENT.id),
    fromFirestore: true,
  };

  const experiences: FirestoreExperienceItem[] = Array.isArray(sd.experiences)
    ? (sd.experiences as Record<string, unknown>[]).map((d, idx) => ({
        id: String(d.id ?? `exp_${idx}`),
        company: String(d.company ?? ''),
        role: String(d.role ?? ''),
        roleId: String(d.roleId ?? d.role ?? ''),
        status: VALID_EXP_STATUS.has(d.status as ExperienceStatus)
          ? (d.status as ExperienceStatus)
          : 'completed',
        category: d.category === 'leadership' ? 'leadership' : 'operations',
        period: String(d.period ?? ''),
        periodId: String(d.periodId ?? d.period ?? ''),
        scaleContext: String(d.scaleContext ?? ''),
        scaleContextId: String(d.scaleContextId ?? d.scaleContext ?? ''),
        bullets: Array.isArray(d.bullets) ? d.bullets.map(String) : [],
        bulletsId: Array.isArray(d.bulletsId) ? d.bulletsId.map(String) : [],
        systems: Array.isArray(d.systems) ? d.systems.map(String) : [],
        sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : idx,
        careerStages: parseCareerStages(d.careerStages),
        fromFirestore: true,
      }))
    : [];

  const techStacks: FirestoreTechCategory[] = Array.isArray(sd.techStacks)
    ? (sd.techStacks as Record<string, unknown>[]).map((d, idx) => ({
        id: String(d.id ?? `stack_${idx}`),
        group: VALID_TECH_GROUPS.has(d.group as TechCategory['group'])
          ? (d.group as TechCategory['group'])
          : 'core',
        label: String(d.label ?? ''),
        labelId: String(d.labelId ?? d.label ?? ''),
        items: Array.isArray(d.items) ? d.items.map(String) : [],
        sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : idx,
        fromFirestore: true,
      }))
    : [];

  const references: FirestoreReferenceItem[] = Array.isArray(sd.references)
    ? (sd.references as Record<string, unknown>[]).map((d, idx) => {
        const phone = String(d.phone ?? '');
        const digits = phone.replace(/\D/g, '');
        const phoneHref = digits.startsWith('0')
          ? `tel:+62${digits.slice(1)}`
          : digits
            ? `tel:+${digits}`
            : '#';
        return {
          id: String(d.id ?? `ref_${idx}`),
          name: String(d.name ?? ''),
          role: String(d.role ?? ''),
          phone,
          phoneHref,
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : idx,
          fromFirestore: true,
        };
      })
    : [];

  const projectMetaList = Array.isArray(sd.projectMeta)
    ? (sd.projectMeta as SharedProjectMeta[])
    : [];

  const projects: ProjectPhotoItem[] = await Promise.all(
    projectMetaList.map(async (meta) => {
      let imageDataUrl = '';
      try {
        const assetSnap = await getDocFromServer(
          doc(db, 'cvProjectAssets', `${vaultKey}__${meta.id}`)
        );
        if (assetSnap.exists() && typeof assetSnap.data()?.imageDataUrl === 'string') {
          imageDataUrl = assetSnap.data().imageDataUrl;
        }
      } catch {
        // Ignore missing asset
      }
      return {
        id: meta.id,
        title: String(meta.title ?? ''),
        property: String(meta.property ?? ''),
        year: String(meta.year ?? ''),
        category: VALID_PROJECT_CATS.has(meta.category) ? meta.category : 'infrastructure',
        description: String(meta.description ?? ''),
        imageDataUrl,
        authorId: '',
        createdAt: typeof meta.createdAtMs === 'number' ? meta.createdAtMs : Date.now(),
      };
    })
  );

  return {
    token,
    vaultKey,
    label,
    expiresAtMs,
    profile,
    siteContent,
    experiences,
    projects: projects.filter((p) => Boolean(p.imageDataUrl)),
    techStacks,
    references,
  };
}

export function subscribeInviteSession(
  token: string,
  initialVaultKey: string,
  onUpdate: (session: ResolvedInviteSession) => void,
  onRevoked: () => void
): () => void {
  if (!TOKEN_PATTERN.test(token) || !VAULT_KEY_PATTERN.test(initialVaultKey)) {
    return () => {};
  }

  let activeVaultKey = initialVaultKey;
  let activeLabel = token;
  let activeExpiresAtMs: number | null = null;
  let unsubShare: (() => void) | null = null;

  const attachShareListener = (vaultKey: string) => {
    unsubShare?.();
    if (!VAULT_KEY_PATTERN.test(vaultKey)) return;
    unsubShare = onSnapshot(
      doc(db, 'cvShares', vaultKey),
      (snap) => {
        if (!snap.exists()) return;
        const sd = snap.data() as Record<string, unknown>;
        void import('./cvFirestoreApi').then(({ DEFAULT_PROFILE_DATA, DEFAULT_SITE_CONTENT }) =>
          parseShareBundleIntoSession({
            token,
            vaultKey,
            label: activeLabel,
            expiresAtMs: activeExpiresAtMs,
            sd,
            DEFAULT_PROFILE_DATA,
            DEFAULT_SITE_CONTENT,
          }).then(onUpdate)
        );
      },
      () => {
        // Ignore transient share read errors while offline
      }
    );
  };

  attachShareListener(activeVaultKey);

  const unsubInvite = onSnapshot(
    doc(db, 'invites', token),
    (invSnap) => {
      if (!invSnap.exists()) {
        onRevoked();
        return;
      }
      const d = invSnap.data();
      const isActive = Boolean(d.active);
      const expMs = toMillis(d.expiresAt);
      if (!isActive || (expMs !== null && expMs <= Date.now())) {
        onRevoked();
        return;
      }
      activeLabel = typeof d.label === 'string' ? d.label : token;
      activeExpiresAtMs = expMs;
      const nextVault = typeof d.vaultKey === 'string' ? d.vaultKey : activeVaultKey;
      if (nextVault !== activeVaultKey && VAULT_KEY_PATTERN.test(nextVault)) {
        activeVaultKey = nextVault;
        attachShareListener(activeVaultKey);
      }
    },
    () => {
      onRevoked();
    }
  );

  return () => {
    unsubInvite();
    unsubShare?.();
  };
}
