import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  CareerStage,
  EmploymentType,
  EXPERIENCES,
  ExperienceItem,
  ExperienceStatus,
} from '../data/cvData';
import { unwrapUpsertError, upsertAdminDoc, withAdminRetry } from './firestoreCore';
import {
  readCvIndex,
  registerEntityInCvIndex,
  schedulePublishedSnapshotSync,
} from './inviteApi';

export interface FirestoreExperienceItem extends ExperienceItem {
  fromFirestore: boolean;
}

const VALID_STATUS = new Set<ExperienceStatus>(['active', 'completed']);
const VALID_CATEGORIES = new Set<'leadership' | 'operations'>(['leadership', 'operations']);
export const VALID_EMPLOYMENT_TYPES = new Set<EmploymentType>([
  'full-time',
  'promotion',
  'contract',
  'consulting',
]);
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, { en: string; id: string }> = {
  'full-time': { en: 'Full-Time', id: 'Penuh Waktu' },
  promotion: { en: 'Promoted', id: 'Promosi Jabatan' },
  contract: { en: 'Contract / Project', id: 'Kontrak / Proyek' },
  consulting: { en: 'Advisory / Consulting', id: 'Konsultan' },
};

function sanitizeStageId(raw: unknown, fallback: string): string {
  const cleaned = typeof raw === 'string' ? raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) : '';
  return cleaned || fallback.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128) || 'stage_0';
}

export function parseCareerStages(raw: unknown): CareerStage[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const stages: CareerStage[] = [];
  for (let i = 0; i < Math.min(raw.length, 8); i += 1) {
    const entry = raw[i];
    if (typeof entry !== 'object' || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const role = typeof rec.role === 'string' ? rec.role.trim().slice(0, 140) : '';
    const period = typeof rec.period === 'string' ? rec.period.trim().slice(0, 60) : '';
    const bullets = Array.isArray(rec.bullets)
      ? rec.bullets.filter((b): b is string => typeof b === 'string').map((b) => b.trim().slice(0, 500)).filter(Boolean).slice(0, 15)
      : [];
    const bulletsId = Array.isArray(rec.bulletsId)
      ? rec.bulletsId.filter((b): b is string => typeof b === 'string').map((b) => b.trim().slice(0, 500)).filter(Boolean).slice(0, 15)
      : [];
    if (!role || !period || bullets.length === 0) continue;

    const employmentType = VALID_EMPLOYMENT_TYPES.has(rec.employmentType as EmploymentType)
      ? (rec.employmentType as EmploymentType)
      : undefined;

    stages.push({
      id: sanitizeStageId(rec.id, `stage_${i}`),
      role,
      roleId: (typeof rec.roleId === 'string' && rec.roleId.trim() ? rec.roleId : role).trim().slice(0, 140),
      status: VALID_STATUS.has(rec.status as ExperienceStatus)
        ? (rec.status as ExperienceStatus)
        : 'completed',
      ...(employmentType ? { employmentType } : {}),
      period,
      periodId: (typeof rec.periodId === 'string' && rec.periodId.trim() ? rec.periodId : period).trim().slice(0, 60),
      bullets,
      bulletsId: bulletsId.length > 0 ? bulletsId : bullets,
    });
  }
  return stages.length > 0 ? stages : undefined;
}

export function normalizeExperienceStages(
  exp: Pick<
    ExperienceItem,
    'id' | 'role' | 'roleId' | 'status' | 'period' | 'periodId' | 'bullets' | 'bulletsId' | 'careerStages'
  >
): CareerStage[] {
  if (exp.careerStages && exp.careerStages.length > 0) {
    return exp.careerStages;
  }
  return [
    {
      id: sanitizeStageId(`${exp.id}_stage_0`, 'stage_0'),
      role: exp.role,
      roleId: exp.roleId || exp.role,
      status: exp.status,
      period: exp.period,
      periodId: exp.periodId || exp.period,
      bullets: exp.bullets,
      bulletsId: exp.bulletsId.length > 0 ? exp.bulletsId : exp.bullets,
    },
  ];
}

function mapExperienceDoc(id: string, data: Record<string, unknown>): FirestoreExperienceItem {
  const role = typeof data.role === 'string' ? data.role : '';
  const period = typeof data.period === 'string' ? data.period : '';
  const scaleContext = typeof data.scaleContext === 'string' ? data.scaleContext : '';
  return {
    id,
    company: typeof data.company === 'string' ? data.company : '',
    role,
    roleId: typeof data.roleId === 'string' ? data.roleId : role,
    status: VALID_STATUS.has(data.status as ExperienceStatus)
      ? (data.status as ExperienceStatus)
      : 'completed',
    category: VALID_CATEGORIES.has(data.category as 'leadership' | 'operations')
      ? (data.category as 'leadership' | 'operations')
      : 'operations',
    period,
    periodId: typeof data.periodId === 'string' ? data.periodId : period,
    scaleContext,
    scaleContextId: typeof data.scaleContextId === 'string' ? data.scaleContextId : scaleContext,
    bullets: Array.isArray(data.bullets)
      ? data.bullets.filter((b): b is string => typeof b === 'string')
      : [],
    bulletsId: Array.isArray(data.bulletsId)
      ? data.bulletsId.filter((b): b is string => typeof b === 'string')
      : [],
    systems: Array.isArray(data.systems)
      ? data.systems.filter((s): s is string => typeof s === 'string')
      : [],
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 99,
    careerStages: parseCareerStages(data.careerStages),
    fromFirestore: true,
  };
}

export function subscribeExperiences(
  onData: (items: FirestoreExperienceItem[], hasFirestoreDocs: boolean) => void,
  onError: (err: Error) => void
): () => void {
  if (!auth.currentUser) return () => {};
  const expRef = collection(db, 'experiences');
  const q = query(expRef, orderBy('sortOrder', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(
          EXPERIENCES.map((item) => ({ ...item, fromFirestore: false })),
          false
        );
        return;
      }

      const firestoreMap = new Map<string, FirestoreExperienceItem>();

      for (const item of EXPERIENCES) {
        firestoreMap.set(item.id, { ...item, fromFirestore: false });
      }

      for (const docSnap of snapshot.docs) {
        firestoreMap.set(
          docSnap.id,
          mapExperienceDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
        );
      }

      const merged = Array.from(firestoreMap.values()).sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
      onData(merged, true);
    },
    (error) => {
      if (!auth.currentUser) return;
      void (async () => {
        const idx = await readCvIndex();
        if (idx) {
          const firestoreMap = new Map<string, FirestoreExperienceItem>();
          EXPERIENCES.forEach((item) => firestoreMap.set(item.id, { ...item, fromFirestore: false }));
          await Promise.all(
            idx.experienceIds.map(async (id) => {
              try {
                const snap = await getDocFromServer(doc(db, 'experiences', id));
                if (!snap.exists()) return;
                firestoreMap.set(
                  snap.id,
                  mapExperienceDoc(snap.id, snap.data() as Record<string, unknown>)
                );
              } catch {
                // Ignore
              }
            })
          );
          onData(
            Array.from(firestoreMap.values()).sort((a, b) => a.sortOrder - b.sortOrder),
            true
          );
          return;
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'experiences');
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      })();
    }
  );
}

function sanitizeExperiencePayload(input: Omit<ExperienceItem, 'id'>) {
  const company = input.company.trim().slice(0, 140);
  const category: 'leadership' | 'operations' = VALID_CATEGORIES.has(input.category)
    ? input.category
    : 'operations';
  const scaleContext = input.scaleContext.trim().slice(0, 200);
  const scaleContextId = (input.scaleContextId || input.scaleContext).trim().slice(0, 200);
  const systems = input.systems
    .map((s) => s.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 25);
  const sortOrder = Math.max(0, Math.min(1000, Math.round(Number(input.sortOrder) || 0)));

  const sanitizedStages: CareerStage[] = Array.isArray(input.careerStages)
    ? input.careerStages
        .slice(0, 8)
        .map((s, idx) => {
          const stageRole = s.role.trim().slice(0, 140);
          const stageRoleId = (s.roleId || s.role).trim().slice(0, 140);
          const stagePeriod = s.period.trim().slice(0, 60);
          const stagePeriodId = (s.periodId || s.period).trim().slice(0, 60);
          const stageBullets = s.bullets
            .map((b) => b.trim().slice(0, 500))
            .filter(Boolean)
            .slice(0, 15);
          const stageBulletsId = (s.bulletsId.length > 0 ? s.bulletsId : stageBullets)
            .map((b) => b.trim().slice(0, 500))
            .filter(Boolean)
            .slice(0, 15);
          const employmentType = VALID_EMPLOYMENT_TYPES.has(s.employmentType as EmploymentType)
            ? (s.employmentType as EmploymentType)
            : undefined;
          return {
            id: sanitizeStageId(s.id, `stage_${idx}_${Date.now()}`),
            role: stageRole,
            roleId: stageRoleId || stageRole,
            status: VALID_STATUS.has(s.status) ? s.status : 'completed',
            ...(employmentType ? { employmentType } : {}),
            period: stagePeriod,
            periodId: stagePeriodId || stagePeriod,
            bullets: stageBullets,
            bulletsId: stageBulletsId.length > 0 ? stageBulletsId : stageBullets,
          };
        })
        .filter((s) => Boolean(s.role && s.period && s.bullets.length > 0))
    : [];

  const primaryStage = sanitizedStages[0];
  const role = (primaryStage ? primaryStage.role : input.role).trim().slice(0, 140);
  const roleId = (primaryStage ? primaryStage.roleId : input.roleId || input.role).trim().slice(0, 140);
  const status: ExperienceStatus =
    sanitizedStages.length > 0
      ? sanitizedStages.some((s) => s.status === 'active')
        ? 'active'
        : 'completed'
      : VALID_STATUS.has(input.status)
        ? input.status
        : 'completed';
  const period = (primaryStage ? primaryStage.period : input.period).trim().slice(0, 60);
  const periodId = (primaryStage ? primaryStage.periodId : input.periodId || input.period)
    .trim()
    .slice(0, 60);
  const bullets = primaryStage
    ? primaryStage.bullets
    : input.bullets
        .map((b) => b.trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 15);
  const bulletsId = primaryStage
    ? primaryStage.bulletsId
    : (input.bulletsId.length > 0 ? input.bulletsId : bullets)
        .map((b) => b.trim().slice(0, 500))
        .filter(Boolean)
        .slice(0, 15);

  if (!company) throw new Error('Company name is required.');
  if (!role) throw new Error('Role title is required.');
  if (!period) throw new Error('Period is required.');
  if (bullets.length === 0) throw new Error('At least one achievement bullet is required.');

  const finalStages: CareerStage[] =
    sanitizedStages.length > 0
      ? sanitizedStages
      : [
          {
            id: `stage_0_${Date.now().toString(36)}`,
            role,
            roleId: roleId || role,
            status,
            period,
            periodId: periodId || period,
            bullets,
            bulletsId: bulletsId.length > 0 ? bulletsId : bullets,
          },
        ];

  return {
    company,
    role,
    roleId,
    status,
    category,
    period,
    periodId,
    scaleContext,
    scaleContextId,
    bullets,
    bulletsId: bulletsId.length > 0 ? bulletsId : bullets,
    systems,
    sortOrder,
    careerStages: finalStages,
  };
}

export async function saveExperienceToFirestore(
  item: ExperienceItem,
  alreadyInFirestore: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required.');
  }

  const sanitizedId = item.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  if (!sanitizedId) {
    throw new Error('Invalid experience ID.');
  }
  const sanitized = sanitizeExperiencePayload(item);
  const path = `experiences/${sanitizedId}`;

  try {
    await upsertAdminDoc(doc(db, 'experiences', sanitizedId), sanitized);
    await registerEntityInCvIndex('experienceIds', sanitizedId, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    const resolved = unwrapUpsertError(error, alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE);
    handleFirestoreError(resolved.cause, resolved.op, path);
  }
}

export async function createExperienceInFirestore(
  input: Omit<ExperienceItem, 'id'>
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required.');
  }

  const sanitized = sanitizeExperiencePayload(input);
  const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `experiences/${id}`;

  try {
    await upsertAdminDoc(doc(db, 'experiences', id), sanitized);
    await registerEntityInCvIndex('experienceIds', id, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    const resolved = unwrapUpsertError(error, OperationType.CREATE);
    handleFirestoreError(resolved.cause, resolved.op, path);
  }
}

export async function deleteExperienceFromFirestore(id: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required.');
  }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw new Error('Invalid experience ID.');
  }

  const path = `experiences/${id}`;
  try {
    await withAdminRetry(() => deleteDoc(doc(db, 'experiences', id)));
    await registerEntityInCvIndex('experienceIds', id, 'remove');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
