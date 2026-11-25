import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { EXPERIENCES, ExperienceItem, ExperienceStatus } from '../data/cvData';
import { upsertFirestoreDoc } from './cvFirestoreApi';
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
        const data = docSnap.data();
        const item: FirestoreExperienceItem = {
          id: docSnap.id,
          company: typeof data.company === 'string' ? data.company : '',
          role: typeof data.role === 'string' ? data.role : '',
          roleId: typeof data.roleId === 'string' ? data.roleId : typeof data.role === 'string' ? data.role : '',
          status: VALID_STATUS.has(data.status as ExperienceStatus)
            ? (data.status as ExperienceStatus)
            : 'completed',
          category: VALID_CATEGORIES.has(data.category as 'leadership' | 'operations')
            ? (data.category as 'leadership' | 'operations')
            : 'operations',
          period: typeof data.period === 'string' ? data.period : '',
          periodId: typeof data.periodId === 'string' ? data.periodId : typeof data.period === 'string' ? data.period : '',
          scaleContext: typeof data.scaleContext === 'string' ? data.scaleContext : '',
          scaleContextId:
            typeof data.scaleContextId === 'string'
              ? data.scaleContextId
              : typeof data.scaleContext === 'string'
                ? data.scaleContext
                : '',
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
          fromFirestore: true,
        };
        firestoreMap.set(docSnap.id, item);
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
                const data = snap.data();
                firestoreMap.set(snap.id, {
                  id: snap.id,
                  company: typeof data.company === 'string' ? data.company : '',
                  role: typeof data.role === 'string' ? data.role : '',
                  roleId:
                    typeof data.roleId === 'string'
                      ? data.roleId
                      : typeof data.role === 'string'
                        ? data.role
                        : '',
                  status: VALID_STATUS.has(data.status as ExperienceStatus)
                    ? (data.status as ExperienceStatus)
                    : 'completed',
                  category: VALID_CATEGORIES.has(data.category as 'leadership' | 'operations')
                    ? (data.category as 'leadership' | 'operations')
                    : 'operations',
                  period: typeof data.period === 'string' ? data.period : '',
                  periodId:
                    typeof data.periodId === 'string'
                      ? data.periodId
                      : typeof data.period === 'string'
                        ? data.period
                        : '',
                  scaleContext: typeof data.scaleContext === 'string' ? data.scaleContext : '',
                  scaleContextId:
                    typeof data.scaleContextId === 'string'
                      ? data.scaleContextId
                      : typeof data.scaleContext === 'string'
                        ? data.scaleContext
                        : '',
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
                  fromFirestore: true,
                });
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
  const role = input.role.trim().slice(0, 140);
  const roleId = (input.roleId || input.role).trim().slice(0, 140);
  const status: ExperienceStatus = VALID_STATUS.has(input.status) ? input.status : 'completed';
  const category: 'leadership' | 'operations' = VALID_CATEGORIES.has(input.category)
    ? input.category
    : 'operations';
  const period = input.period.trim().slice(0, 60);
  const periodId = (input.periodId || input.period).trim().slice(0, 60);
  const scaleContext = input.scaleContext.trim().slice(0, 200);
  const scaleContextId = (input.scaleContextId || input.scaleContext).trim().slice(0, 200);

  const bullets = input.bullets
    .map((b) => b.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 15);
  const bulletsId = (input.bulletsId.length > 0 ? input.bulletsId : bullets)
    .map((b) => b.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 15);
  const systems = input.systems
    .map((s) => s.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 25);

  const sortOrder = Math.max(0, Math.min(1000, Math.round(Number(input.sortOrder) || 0)));

  if (!company) throw new Error('Company name is required.');
  if (!role) throw new Error('Role title is required.');
  if (!period) throw new Error('Period is required.');
  if (bullets.length === 0) throw new Error('At least one achievement bullet is required.');

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
    await upsertFirestoreDoc(doc(db, 'experiences', sanitizedId), sanitized, path);
    await registerEntityInCvIndex('experienceIds', sanitizedId, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE, path);
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
    await setDoc(doc(db, 'experiences', id), {
      ...sanitized,
      authorId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await registerEntityInCvIndex('experienceIds', id, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
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
    await deleteDoc(doc(db, 'experiences', id));
    await registerEntityInCvIndex('experienceIds', id, 'remove');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
