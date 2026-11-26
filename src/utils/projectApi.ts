import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import {
  ADMIN_EMAIL_ALLOWLIST,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { isValidEmailAddress } from './safeUrls';
import {
  readCvIndex,
  registerEntityInCvIndex,
  schedulePublishedSnapshotSync,
} from './inviteApi';

export type ProjectCategory = 'infrastructure' | 'pms-pos' | 'security' | 'event-av';

export interface ProjectPhotoItem {
  id: string;
  title: string;
  property: string;
  year: string;
  category: ProjectCategory;
  description: string;
  imageDataUrl: string;
  authorId: string;
  createdAt: number;
}

const MAX_TITLE_LEN = 140;
const MAX_PROPERTY_LEN = 140;
const MAX_YEAR_LEN = 24;
const MAX_DESC_LEN = 1200;
const MAX_IMAGE_DATA_URL_LEN = 750000;
const YEAR_PATTERN = /^[0-9A-Za-z\s-]+$/;
const DATA_IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const VALID_CATEGORIES = new Set<ProjectCategory>([
  'infrastructure',
  'pms-pos',
  'security',
  'event-av',
]);

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const UID_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;

export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user) return false;
  try {
    const uidSnap = await getDocFromServer(doc(db, 'admins', user.uid));
    if (uidSnap.exists()) return true;
  } catch {
    try {
      const uidCached = await getDoc(doc(db, 'admins', user.uid));
      if (uidCached.exists()) return true;
    } catch {
      // Continue to email check
    }
  }

  const email = user.email?.trim().toLowerCase() ?? '';
  if (user.emailVerified && email) {
    if (ADMIN_EMAIL_ALLOWLIST.has(email)) {
      return true;
    }
    try {
      const emailSnap = await getDocFromServer(doc(db, 'admins', email));
      if (emailSnap.exists()) return true;
    } catch {
      try {
        const emailCached = await getDoc(doc(db, 'admins', email));
        if (emailCached.exists()) return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}

export async function syncAdminRecord(
  user: User
): Promise<{ synced: boolean; error?: string }> {
  const rawEmail = user.email?.trim() ?? '';
  const normalized = rawEmail.toLowerCase();
  const safeEmail = isValidEmailAddress(normalized) ? normalized : 'uid-admin@cv-junianto.local';

  let existingUidData: Record<string, unknown> | null = null;
  try {
    const uidSnap = await getDocFromServer(doc(db, 'admins', user.uid));
    if (uidSnap.exists()) {
      existingUidData = uidSnap.data() as Record<string, unknown>;
    }
  } catch {
    // Ignore read check failure and continue
  }

  if (!existingUidData && (!user.emailVerified || !rawEmail)) {
    return { synced: false, error: 'Account email is not verified.' };
  }

  const allowed = existingUidData !== null || (await checkIsAdminUser(user));
  if (!allowed) {
    return { synced: false, error: 'Account is not registered as an admin.' };
  }

  const provider = user.providerData?.[0]?.providerId || 'firebase';
  const existingAddedBy =
    existingUidData && typeof existingUidData.addedBy === 'string'
      ? existingUidData.addedBy
      : !user.emailVerified
        ? user.uid
        : null;

  try {
    await setDoc(doc(db, 'admins', user.uid), {
      email: safeEmail,
      role: 'admin',
      provider: provider.slice(0, 40),
      ...(existingAddedBy ? { addedBy: existingAddedBy } : {}),
      updatedAt: serverTimestamp(),
    });
    return { synced: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Admin registry sync warning:', msg);
    return { synced: false, error: msg };
  }
}

export async function listFirestoreAdminEmails(): Promise<{
  coreEmails: string[];
  addedEmails: string[];
}> {
  const coreEmails = Array.from(ADMIN_EMAIL_ALLOWLIST);
  try {
    const snap = await getDocFromServer(doc(db, 'adminsRegistry', 'emails'));
    if (!snap.exists()) {
      return { coreEmails, addedEmails: [] };
    }
    const rawEmails = snap.data()?.emails;
    const addedEmails = Array.isArray(rawEmails)
      ? rawEmails
          .filter((item): item is string => typeof item === 'string' && isValidEmailAddress(item))
          .map((e) => e.trim().toLowerCase())
          .filter((e) => !ADMIN_EMAIL_ALLOWLIST.has(e))
      : [];
    return { coreEmails, addedEmails };
  } catch {
    return { coreEmails, addedEmails: [] };
  }
}

export async function addAdminAccessToFirestore(
  rawInput: string
): Promise<{ kind: 'email' | 'uid'; value: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const trimmed = rawInput.trim();
  const cleanEmail = trimmed.toLowerCase();

  if (isValidEmailAddress(cleanEmail)) {
    const emailDocRef = doc(db, 'admins', cleanEmail);
    try {
      await setDoc(emailDocRef, {
        email: cleanEmail,
        role: 'admin',
        provider: 'firestore-admin',
        addedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });

      const regRef = doc(db, 'adminsRegistry', 'emails');
      const regSnap = await getDocFromServer(regRef);
      const prevList =
        regSnap.exists() && Array.isArray(regSnap.data()?.emails)
          ? (regSnap.data().emails as unknown[])
              .filter((x): x is string => typeof x === 'string')
              .map((x) => x.trim().toLowerCase())
          : [];
      const nextList = Array.from(new Set([...prevList, cleanEmail])).slice(0, 50);

      const regData = regSnap.exists() ? regSnap.data() : null;
      const authorId =
        typeof regData?.authorId === 'string' && regData.authorId.length > 0
          ? regData.authorId
          : currentUser.uid;
      const createdAt = regData?.createdAt != null ? regData.createdAt : serverTimestamp();

      await setDoc(regRef, {
        emails: nextList,
        authorId,
        createdAt,
        updatedAt: serverTimestamp(),
      });
      return { kind: 'email', value: cleanEmail };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${cleanEmail}`);
    }
  }

  if (UID_PATTERN.test(trimmed)) {
    const uidDocRef = doc(db, 'admins', trimmed);
    try {
      await setDoc(uidDocRef, {
        email: 'uid-admin@cv-junianto.local',
        role: 'admin',
        provider: 'uid-admin',
        addedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      return { kind: 'uid', value: trimmed };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${trimmed}`);
    }
  }

  throw new Error('Masukkan alamat email yang valid atau Firebase User UID yang valid.');
}

export async function addAdminEmailToFirestore(rawEmail: string): Promise<void> {
  await addAdminAccessToFirestore(rawEmail);
}

export async function removeAdminEmailFromFirestore(rawEmail: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const cleanEmail = rawEmail.trim().toLowerCase();
  if (ADMIN_EMAIL_ALLOWLIST.has(cleanEmail)) {
    throw new Error('Email admin utama tidak dapat dihapus.');
  }
  if (currentUser.email?.trim().toLowerCase() === cleanEmail) {
    throw new Error('Tidak dapat menghapus email yang sedang Anda gunakan.');
  }

  try {
    await deleteDoc(doc(db, 'admins', cleanEmail));

    const regRef = doc(db, 'adminsRegistry', 'emails');
    const regSnap = await getDocFromServer(regRef);
    if (regSnap.exists() && Array.isArray(regSnap.data()?.emails)) {
      const regData = regSnap.data();
      const nextList = (regData.emails as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().toLowerCase())
        .filter((x) => x !== cleanEmail);
      const authorId =
        typeof regData?.authorId === 'string' && regData.authorId.length > 0
          ? regData.authorId
          : currentUser.uid;
      const createdAt = regData?.createdAt != null ? regData.createdAt : serverTimestamp();
      await setDoc(regRef, {
        emails: nextList,
        authorId,
        createdAt,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${cleanEmail}`);
  }
}

export async function signInAdminWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  await user.getIdToken(true);
  const isAdmin = await checkIsAdminUser(user);
  if (!isAdmin) {
    const signedEmail = user.email ?? 'unknown';
    await signOut(auth);
    throw new Error(`AUTH_UNAUTHORIZED_EMAIL:${signedEmail}`);
  }
  await syncAdminRecord(user);
  await user.getIdToken(true);
  return user;
}

export async function signInAdminWithGoogleRedirect(): Promise<void> {
  if (isRunningInIframe()) {
    throw new Error(
      'Redirect sign-in cannot run inside an embedded iframe. Open the deployed site directly or allow popups.'
    );
  }
  await signInWithRedirect(auth, googleProvider);
}

export async function consumeGoogleRedirectResult(): Promise<{
  user: User | null;
  error: string | null;
}> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) {
      return { user: null, error: null };
    }
    const user = result.user;
    await user.getIdToken(true);
    const isAdmin = await checkIsAdminUser(user);
    if (!isAdmin) {
      const signedEmail = user.email ?? 'unknown';
      await signOut(auth);
      return { user: null, error: `AUTH_UNAUTHORIZED_EMAIL:${signedEmail}` };
    }
    await syncAdminRecord(user);
    await user.getIdToken(true);
    return { user, error: null };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function signInAdminWithEmail(
  email: string,
  password: string
): Promise<{ user: User; isAdmin: boolean; needsVerification: boolean }> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = credential.user;
  await user.getIdToken(true);
  const isAdmin = await checkIsAdminUser(user);

  if (isAdmin) {
    await syncAdminRecord(user);
    await user.getIdToken(true);
    return { user, isAdmin: true, needsVerification: false };
  }

  if (!user.emailVerified) {
    return { user, isAdmin: false, needsVerification: true };
  }

  const signedEmail = user.email ?? email.trim();
  await signOut(auth);
  throw new Error(`AUTH_UNAUTHORIZED_EMAIL:${signedEmail}`);
}

export async function registerAdminWithEmail(
  email: string,
  password: string
): Promise<{ user: User; isAdmin: boolean; needsVerification: boolean }> {
  const cleanEmail = email.trim();
  if (!isValidEmailAddress(cleanEmail)) {
    throw new Error('Masukkan alamat email yang valid.');
  }
  const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const user = credential.user;
  await sendEmailVerification(user).catch(() => undefined);
  await user.getIdToken(true);
  const isAdmin = await checkIsAdminUser(user);
  if (isAdmin) {
    await syncAdminRecord(user);
    await user.getIdToken(true);
    return { user, isAdmin: true, needsVerification: false };
  }
  return { user, isAdmin: false, needsVerification: !user.emailVerified };
}

export async function sendAdminVerificationEmail(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required.');
  await sendEmailVerification(user);
}

export async function sendAdminPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) throw new Error('Please enter your email address first.');
  await sendPasswordResetEmail(auth, cleanEmail);
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export function subscribeProjects(
  onData: (projects: ProjectPhotoItem[]) => void,
  onError: (err: Error) => void
): () => void {
  if (!auth.currentUser) return () => {};
  const projectsRef = collection(db, 'projects');
  const q = query(projectsRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ProjectPhotoItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const ts = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
        return {
          id: docSnap.id,
          title: typeof data.title === 'string' ? data.title : '',
          property: typeof data.property === 'string' ? data.property : '',
          year: typeof data.year === 'string' ? data.year : '',
          category: VALID_CATEGORIES.has(data.category as ProjectCategory)
            ? (data.category as ProjectCategory)
            : 'infrastructure',
          description: typeof data.description === 'string' ? data.description : '',
          imageDataUrl: typeof data.imageDataUrl === 'string' ? data.imageDataUrl : '',
          authorId: typeof data.authorId === 'string' ? data.authorId : '',
          createdAt: ts,
        };
      });
      onData(items);
    },
    (error) => {
      if (!auth.currentUser) return;
      void (async () => {
        const idx = await readCvIndex();
        if (idx) {
          const items: ProjectPhotoItem[] = [];
          await Promise.all(
            idx.projectIds.map(async (id) => {
              try {
                const snap = await getDocFromServer(doc(db, 'projects', id));
                if (!snap.exists()) return;
                const data = snap.data();
                const ts = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
                items.push({
                  id: snap.id,
                  title: typeof data.title === 'string' ? data.title : '',
                  property: typeof data.property === 'string' ? data.property : '',
                  year: typeof data.year === 'string' ? data.year : '',
                  category: VALID_CATEGORIES.has(data.category as ProjectCategory)
                    ? (data.category as ProjectCategory)
                    : 'infrastructure',
                  description: typeof data.description === 'string' ? data.description : '',
                  imageDataUrl: typeof data.imageDataUrl === 'string' ? data.imageDataUrl : '',
                  authorId: typeof data.authorId === 'string' ? data.authorId : '',
                  createdAt: ts,
                });
              } catch {
                // Ignore
              }
            })
          );
          onData(items.sort((a, b) => a.createdAt - b.createdAt));
          return;
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'projects');
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      })();
    }
  );
}

function sanitizeProjectFields(input: {
  title: string;
  property: string;
  year: string;
  category: ProjectCategory;
  description: string;
  imageDataUrl: string;
}) {
  const title = input.title.trim().slice(0, MAX_TITLE_LEN);
  const property = input.property.trim().slice(0, MAX_PROPERTY_LEN);
  const rawYear = input.year.trim().slice(0, MAX_YEAR_LEN);
  const year = YEAR_PATTERN.test(rawYear) ? rawYear : String(new Date().getFullYear());
  const category = VALID_CATEGORIES.has(input.category) ? input.category : 'infrastructure';
  const description = input.description.trim().slice(0, MAX_DESC_LEN);
  const imageDataUrl = input.imageDataUrl.trim();

  if (!title) throw new Error('Project name is required.');
  if (!year) throw new Error('Project year is required.');
  if (!DATA_IMAGE_PATTERN.test(imageDataUrl) || imageDataUrl.length > MAX_IMAGE_DATA_URL_LEN) {
    throw new Error('Image must be a compressed JPEG, PNG, or WebP under 750 KB.');
  }

  return { title, property, year, category, description, imageDataUrl };
}

export async function createFirestoreProject(input: {
  title: string;
  property: string;
  year: string;
  category: ProjectCategory;
  description: string;
  imageDataUrl: string;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required.');
  }

  const sanitized = sanitizeProjectFields(input);
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `projects/${projectId}`;

  try {
    await setDoc(doc(db, 'projects', projectId), {
      ...sanitized,
      authorId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await registerEntityInCvIndex('projectIds', projectId, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFirestoreProject(
  projectId: string,
  input: {
    title: string;
    property: string;
    year: string;
    category: ProjectCategory;
    description: string;
    imageDataUrl: string;
  }
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required.');
  }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(projectId)) {
    throw new Error('Invalid project ID.');
  }

  const sanitized = sanitizeProjectFields(input);
  const path = `projects/${projectId}`;

  try {
    const docRef = doc(db, 'projects', projectId);
    const snap = await getDocFromServer(docRef);
    const existing = snap.exists() ? snap.data() : null;
    const authorId =
      typeof existing?.authorId === 'string' && existing.authorId.length > 0
        ? existing.authorId
        : currentUser.uid;
    const createdAt = existing?.createdAt != null ? existing.createdAt : serverTimestamp();
    await setDoc(docRef, {
      ...sanitized,
      authorId,
      createdAt,
      updatedAt: serverTimestamp(),
    });
    await registerEntityInCvIndex('projectIds', projectId, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFirestoreProject(projectId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required.');
  }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(projectId)) {
    throw new Error('Invalid project ID.');
  }

  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
    await registerEntityInCvIndex('projectIds', projectId, 'remove');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function compressImageFile(file: File, maxDimension = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image (JPG, PNG, or WebP).'));
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('Image size must be 15 MB or smaller.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or corrupted image file.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Step down JPEG quality if needed to stay safely below Firestore's 1MB doc limit
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 700_000 && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > MAX_IMAGE_DATA_URL_LEN) {
          reject(new Error('Compressed image still exceeds 750 KB limit. Please use a smaller photo.'));
          return;
        }

        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
