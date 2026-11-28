import {
  doc,
  DocumentReference,
  getDocFromServer,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  hasValidFirestoreTimestamp,
  isPermissionError,
  OperationType,
} from '../firebase';

export class UpsertStepError extends Error {
  readonly op: OperationType;
  readonly causeError: unknown;

  constructor(op: OperationType, causeError: unknown) {
    super(causeError instanceof Error ? causeError.message : String(causeError));
    this.op = op;
    this.causeError = causeError;
  }
}

export function unwrapUpsertError(
  error: unknown,
  fallbackOp: OperationType
): { op: OperationType; cause: unknown } {
  if (error instanceof UpsertStepError) {
    return { op: error.op, cause: error.causeError };
  }
  return { op: fallbackOp, cause: error };
}

export async function withAdminRetry<T>(task: () => Promise<T>): Promise<T> {
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

export async function upsertAdminDoc(
  docRef: DocumentReference,
  payload: Record<string, unknown>
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const snap = await withAdminRetry(() => getDocFromServer(docRef)).catch((err) => {
    throw new UpsertStepError(OperationType.GET, err);
  });

  if (!snap.exists()) {
    await withAdminRetry(() =>
      setDoc(docRef, {
        ...payload,
        authorId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    ).catch((err) => {
      throw new UpsertStepError(OperationType.CREATE, err);
    });
    return;
  }

  const existing = snap.data();
  const preservedAuthorId =
    typeof existing?.authorId === 'string' && existing.authorId.length > 0
      ? existing.authorId
      : currentUser.uid;
  const preservedCreatedAt = hasValidFirestoreTimestamp(existing?.createdAt)
    ? existing.createdAt
    : serverTimestamp();

  await withAdminRetry(() =>
    setDoc(docRef, {
      ...payload,
      authorId: preservedAuthorId,
      createdAt: preservedCreatedAt,
      updatedAt: serverTimestamp(),
    })
  ).catch((err) => {
    throw new UpsertStepError(OperationType.UPDATE, err);
  });
}

export function adminDocRef(collectionName: string, docId: string): DocumentReference {
  return doc(db, collectionName, docId);
}
