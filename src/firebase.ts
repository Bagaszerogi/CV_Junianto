import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, Timestamp } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export const FIREBASE_PUBLIC_META = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
};

export const ADMIN_EMAIL_ALLOWLIST = new Set([
  'it@hotelciputra.com',
  'bagaszerogi@gmail.com',
  'zerogi26@gmail.com',
]);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function hasValidFirestoreTimestamp(val: unknown): boolean {
  if (val instanceof Timestamp) return true;
  return (
    typeof val === 'object' &&
    val !== null &&
    typeof (val as { toMillis?: unknown }).toMillis === 'function'
  );
}

export function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes('permission') || msg.includes('insufficient');
}

export function formatReadableFirestoreError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    if (parsed?.error) {
      const target = [parsed.operationType, parsed.path].filter(Boolean).join(' ');
      const email = parsed.authInfo?.email;
      const verified = parsed.authInfo?.emailVerified;
      const providers = parsed.authInfo?.providerInfo
        ?.map((p) => p?.providerId)
        .filter(Boolean)
        .join(', ');
      if (isPermissionError(parsed.error)) {
        if (!email) {
          return `${parsed.error}${target ? ` (${target})` : ''} — Sesi login belum aktif, silakan masuk kembali.`;
        }
        if (verified === false) {
          return `${parsed.error}${target ? ` (${target})` : ''} — Akun ${email} belum terverifikasi (emailVerified: false). Verifikasi email atau masuk via Google SSO.`;
        }
        return `${parsed.error}${target ? ` (${target})` : ''} — Akun: ${email} (verified${providers ? `, ${providers}` : ''}, DB: ${FIREBASE_PUBLIC_META.firestoreDatabaseId.slice(0, 18)}…). Buka "Cek DB & SSO" untuk detail.`;
      }
      return target ? `${parsed.error} (${target})` : parsed.error;
    }
  } catch {
    // Raw non-JSON error
  }
  return raw;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
