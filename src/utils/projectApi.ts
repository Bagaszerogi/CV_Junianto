import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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

export async function syncAdminRecord(user: User): Promise<void> {
  const rawEmail = user.email?.trim() ?? '';
  const normalized = rawEmail.toLowerCase();
  if (!user.emailVerified || !ADMIN_EMAIL_ALLOWLIST.has(normalized) || !rawEmail) {
    return;
  }

  const provider = user.providerData?.[0]?.providerId || 'firebase';
  try {
    await setDoc(
      doc(db, 'admins', user.uid),
      {
        email: rawEmail,
        role: 'admin',
        provider: provider.slice(0, 40),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Non-fatal: verified email allowlist still authorizes admin access
  }
}

export async function checkIsAdminUser(user: User | null): Promise<boolean> {
  if (!user) return false;
  const email = user.email?.trim().toLowerCase() ?? '';
  if (user.emailVerified && ADMIN_EMAIL_ALLOWLIST.has(email)) {
    return true;
  }
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    return adminSnap.exists();
  } catch {
    return false;
  }
}

export async function signInAdminWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  const isAdmin = await checkIsAdminUser(user);
  if (!isAdmin) {
    const signedEmail = user.email ?? 'unknown';
    await signOut(auth);
    throw new Error(`AUTH_UNAUTHORIZED_EMAIL:${signedEmail}`);
  }
  await syncAdminRecord(user);
  return user;
}

export async function signInAdminWithEmail(
  email: string,
  password: string
): Promise<{ user: User; isAdmin: boolean; needsVerification: boolean }> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = credential.user;
  const normalized = user.email?.trim().toLowerCase() ?? '';
  const isAdmin = await checkIsAdminUser(user);

  if (isAdmin) {
    await syncAdminRecord(user);
    return { user, isAdmin: true, needsVerification: false };
  }

  if (ADMIN_EMAIL_ALLOWLIST.has(normalized) && !user.emailVerified) {
    return { user, isAdmin: false, needsVerification: true };
  }

  const signedEmail = user.email ?? email.trim();
  await signOut(auth);
  throw new Error(`AUTH_UNAUTHORIZED_EMAIL:${signedEmail}`);
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
      try {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
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
    await updateDoc(doc(db, 'projects', projectId), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
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
