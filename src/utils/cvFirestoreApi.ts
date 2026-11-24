import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  CV_PROFILE,
  EDUCATION,
  KEY_METRICS,
  REFERENCES,
  TECH_STACK,
  type ReferenceItem,
  type TechCategory,
} from '../data/cvData';
import { isValidEmailAddress, sanitizePortraitSrc } from './safeUrls';

export interface MetricItem {
  value: string;
  valueId: string;
  label: string;
  labelId: string;
  detail: string;
  detailId: string;
}

export interface EducationData {
  institution: string;
  majorEn: string;
  majorId: string;
  period: string;
  gpaEn: string;
  gpaId: string;
  focusEn: string;
  focusId: string;
}

export interface CvProfileData {
  name: string;
  brandShort: string;
  titleEn: string;
  titleId: string;
  kickerEn: string;
  kickerId: string;
  currentCompany: string;
  currentRole: string;
  summaryEn: string;
  summaryId: string;
  phoneDisplay: string;
  whatsappHref: string;
  email: string;
  address: string;
  portraitDataUrl: string;
  metrics: MetricItem[];
  education: EducationData;
  fromFirestore?: boolean;
}

export interface FirestoreTechCategory extends TechCategory {
  sortOrder: number;
  fromFirestore: boolean;
}

export interface FirestoreReferenceItem extends ReferenceItem {
  id: string;
  sortOrder: number;
  fromFirestore: boolean;
}

export const DEFAULT_PROFILE_DATA: CvProfileData = {
  name: CV_PROFILE.name,
  brandShort: CV_PROFILE.brandShort,
  titleEn: CV_PROFILE.title.en,
  titleId: CV_PROFILE.title.id,
  kickerEn: CV_PROFILE.kicker.en,
  kickerId: CV_PROFILE.kicker.id,
  currentCompany: CV_PROFILE.currentRole.company,
  currentRole: CV_PROFILE.currentRole.role,
  summaryEn: CV_PROFILE.summary.en,
  summaryId: CV_PROFILE.summary.id,
  phoneDisplay: CV_PROFILE.contact.phoneDisplay,
  whatsappHref: CV_PROFILE.contact.whatsappHref,
  email: CV_PROFILE.contact.email,
  address: CV_PROFILE.contact.address,
  portraitDataUrl: CV_PROFILE.portraitSrc,
  metrics: KEY_METRICS,
  education: {
    institution: EDUCATION.institution,
    majorEn: EDUCATION.major.en,
    majorId: EDUCATION.major.id,
    period: EDUCATION.period,
    gpaEn: EDUCATION.gpa,
    gpaId: EDUCATION.gpaId,
    focusEn: EDUCATION.focus.en,
    focusId: EDUCATION.focus.id,
  },
  fromFirestore: false,
};

const VALID_TECH_GROUPS = new Set<TechCategory['group']>([
  'core',
  'infra',
  'guest',
  'productivity',
]);

export function subscribeProfile(
  onData: (profile: CvProfileData) => void,
  onError: (err: Error) => void
): () => void {
  const ref = doc(db, 'profile', 'main');
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData({ ...DEFAULT_PROFILE_DATA, fromFirestore: false });
        return;
      }
      const d = snapshot.data();
      const rawEdu = (typeof d.education === 'object' && d.education !== null ? d.education : {}) as Partial<EducationData>;
      const rawMetrics = Array.isArray(d.metrics) ? (d.metrics as MetricItem[]) : DEFAULT_PROFILE_DATA.metrics;

      onData({
        name: typeof d.name === 'string' ? d.name : DEFAULT_PROFILE_DATA.name,
        brandShort: typeof d.brandShort === 'string' ? d.brandShort : DEFAULT_PROFILE_DATA.brandShort,
        titleEn: typeof d.titleEn === 'string' ? d.titleEn : DEFAULT_PROFILE_DATA.titleEn,
        titleId: typeof d.titleId === 'string' ? d.titleId : DEFAULT_PROFILE_DATA.titleId,
        kickerEn: typeof d.kickerEn === 'string' ? d.kickerEn : DEFAULT_PROFILE_DATA.kickerEn,
        kickerId: typeof d.kickerId === 'string' ? d.kickerId : DEFAULT_PROFILE_DATA.kickerId,
        currentCompany: typeof d.currentCompany === 'string' ? d.currentCompany : DEFAULT_PROFILE_DATA.currentCompany,
        currentRole: typeof d.currentRole === 'string' ? d.currentRole : DEFAULT_PROFILE_DATA.currentRole,
        summaryEn: typeof d.summaryEn === 'string' ? d.summaryEn : DEFAULT_PROFILE_DATA.summaryEn,
        summaryId: typeof d.summaryId === 'string' ? d.summaryId : DEFAULT_PROFILE_DATA.summaryId,
        phoneDisplay: typeof d.phoneDisplay === 'string' ? d.phoneDisplay : DEFAULT_PROFILE_DATA.phoneDisplay,
        whatsappHref: typeof d.whatsappHref === 'string' ? d.whatsappHref : DEFAULT_PROFILE_DATA.whatsappHref,
        email: typeof d.email === 'string' ? d.email : DEFAULT_PROFILE_DATA.email,
        address: typeof d.address === 'string' ? d.address : DEFAULT_PROFILE_DATA.address,
        portraitDataUrl: typeof d.portraitDataUrl === 'string' ? d.portraitDataUrl : DEFAULT_PROFILE_DATA.portraitDataUrl,
        metrics: rawMetrics.length > 0 ? rawMetrics : DEFAULT_PROFILE_DATA.metrics,
        education: {
          institution: typeof rawEdu.institution === 'string' ? rawEdu.institution : DEFAULT_PROFILE_DATA.education.institution,
          majorEn: typeof rawEdu.majorEn === 'string' ? rawEdu.majorEn : DEFAULT_PROFILE_DATA.education.majorEn,
          majorId: typeof rawEdu.majorId === 'string' ? rawEdu.majorId : DEFAULT_PROFILE_DATA.education.majorId,
          period: typeof rawEdu.period === 'string' ? rawEdu.period : DEFAULT_PROFILE_DATA.education.period,
          gpaEn: typeof rawEdu.gpaEn === 'string' ? rawEdu.gpaEn : DEFAULT_PROFILE_DATA.education.gpaEn,
          gpaId: typeof rawEdu.gpaId === 'string' ? rawEdu.gpaId : DEFAULT_PROFILE_DATA.education.gpaId,
          focusEn: typeof rawEdu.focusEn === 'string' ? rawEdu.focusEn : DEFAULT_PROFILE_DATA.education.focusEn,
          focusId: typeof rawEdu.focusId === 'string' ? rawEdu.focusId : DEFAULT_PROFILE_DATA.education.focusId,
        },
        fromFirestore: true,
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'profile/main');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveProfileToFirestore(
  profile: CvProfileData,
  alreadyInFirestore: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const waClean = profile.whatsappHref.trim();
  const normalizedWa = /^https:\/\/wa\.me\/[0-9]+$/.test(waClean)
    ? waClean
    : `https://wa.me/${profile.phoneDisplay.replace(/\D/g, '').replace(/^0/, '62') || '6281225560408'}`;

  const payload = {
    name: profile.name.trim().slice(0, 120),
    brandShort: profile.brandShort.trim().slice(0, 60),
    titleEn: profile.titleEn.trim().slice(0, 140),
    titleId: (profile.titleId || profile.titleEn).trim().slice(0, 140),
    kickerEn: profile.kickerEn.trim().slice(0, 160),
    kickerId: (profile.kickerId || profile.kickerEn).trim().slice(0, 160),
    currentCompany: profile.currentCompany.trim().slice(0, 140),
    currentRole: profile.currentRole.trim().slice(0, 140),
    summaryEn: profile.summaryEn.trim().slice(0, 1500),
    summaryId: (profile.summaryId || profile.summaryEn).trim().slice(0, 1500),
    phoneDisplay: profile.phoneDisplay.trim().slice(0, 40),
    whatsappHref: normalizedWa.slice(0, 200),
    email: profile.email.trim().slice(0, 140),
    address: profile.address.trim().slice(0, 240),
    portraitDataUrl: sanitizePortraitSrc(profile.portraitDataUrl),
    metrics: profile.metrics.slice(0, 6).map((m) => ({
      value: (m.value || '-').trim().slice(0, 40) || '-',
      valueId: (m.valueId || m.value || '-').trim().slice(0, 40) || '-',
      label: (m.label || '-').trim().slice(0, 80) || '-',
      labelId: (m.labelId || m.label || '-').trim().slice(0, 80) || '-',
      detail: (m.detail || '').trim().slice(0, 120),
      detailId: (m.detailId || m.detail || '').trim().slice(0, 120),
    })),
    education: {
      institution: profile.education.institution.trim().slice(0, 160),
      majorEn: profile.education.majorEn.trim().slice(0, 140),
      majorId: (profile.education.majorId || profile.education.majorEn).trim().slice(0, 140),
      period: profile.education.period.trim().slice(0, 40),
      gpaEn: profile.education.gpaEn.trim().slice(0, 40),
      gpaId: (profile.education.gpaId || profile.education.gpaEn).trim().slice(0, 40),
      focusEn: profile.education.focusEn.trim().slice(0, 600),
      focusId: (profile.education.focusId || profile.education.focusEn).trim().slice(0, 600),
    },
  };

  if (!payload.name || !payload.email || !payload.phoneDisplay || !payload.address) {
    throw new Error('Name, Email, Phone, and Address are required.');
  }
  if (!isValidEmailAddress(payload.email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (payload.metrics.length === 0) {
    throw new Error('At least one KPI metric is required.');
  }

  try {
    if (alreadyInFirestore) {
      await updateDoc(doc(db, 'profile', 'main'), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'profile', 'main'), {
        ...payload,
        authorId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE, 'profile/main');
  }
}

export function subscribeTechStacks(
  onData: (items: FirestoreTechCategory[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, 'techStacks'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData(
          TECH_STACK.map((item, idx) => ({
            ...item,
            sortOrder: idx,
            fromFirestore: false,
          }))
        );
        return;
      }

      const mergedMap = new Map<string, FirestoreTechCategory>();
      TECH_STACK.forEach((item, idx) => {
        mergedMap.set(item.id, { ...item, sortOrder: idx, fromFirestore: false });
      });

      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        mergedMap.set(docSnap.id, {
          id: docSnap.id,
          group: VALID_TECH_GROUPS.has(d.group as TechCategory['group'])
            ? (d.group as TechCategory['group'])
            : 'core',
          label: typeof d.label === 'string' ? d.label : '',
          labelId: typeof d.labelId === 'string' ? d.labelId : typeof d.label === 'string' ? d.label : '',
          items: Array.isArray(d.items) ? d.items.filter((x): x is string => typeof x === 'string') : [],
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 99,
          fromFirestore: true,
        });
      }

      onData(Array.from(mergedMap.values()).sort((a, b) => a.sortOrder - b.sortOrder));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'techStacks');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveTechStackToFirestore(
  item: Omit<FirestoreTechCategory, 'fromFirestore'>,
  alreadyInFirestore: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const cleanId = item.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  if (!cleanId) throw new Error('Invalid tech stack ID.');
  const items = item.items.map((x) => x.trim().slice(0, 100)).filter(Boolean).slice(0, 40);
  if (!item.label.trim() || items.length === 0) {
    throw new Error('Category label and at least one tool are required.');
  }

  const payload = {
    group: VALID_TECH_GROUPS.has(item.group) ? item.group : 'core',
    label: item.label.trim().slice(0, 100),
    labelId: (item.labelId || item.label).trim().slice(0, 100),
    items,
    sortOrder: Math.max(0, Math.min(1000, Math.round(Number(item.sortOrder) || 0))),
  };

  try {
    if (alreadyInFirestore) {
      await updateDoc(doc(db, 'techStacks', cleanId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'techStacks', cleanId), {
        ...payload,
        authorId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE, `techStacks/${cleanId}`);
  }
}

export async function deleteTechStackFromFirestore(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentication required.');
  try {
    await deleteDoc(doc(db, 'techStacks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `techStacks/${id}`);
  }
}

export function subscribeReferences(
  onData: (items: FirestoreReferenceItem[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(collection(db, 'references'), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const defaults: FirestoreReferenceItem[] = REFERENCES.map((r, idx) => ({
        ...r,
        id: `ref_default_${idx}`,
        sortOrder: idx,
        fromFirestore: false,
      }));

      if (snapshot.empty) {
        onData(defaults);
        return;
      }

      const mergedMap = new Map<string, FirestoreReferenceItem>();
      defaults.forEach((r) => mergedMap.set(r.id, r));

      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        const phone = typeof d.phone === 'string' ? d.phone : '';
        const digits = phone.replace(/\D/g, '');
        const phoneHref = digits.startsWith('0')
          ? `tel:+62${digits.slice(1)}`
          : digits
            ? `tel:+${digits}`
            : '#';
        mergedMap.set(docSnap.id, {
          id: docSnap.id,
          name: typeof d.name === 'string' ? d.name : '',
          role: typeof d.role === 'string' ? d.role : '',
          phone,
          phoneHref,
          sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 99,
          fromFirestore: true,
        });
      }

      onData(Array.from(mergedMap.values()).sort((a, b) => a.sortOrder - b.sortOrder));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'references');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveReferenceToFirestore(
  item: { id: string; name: string; role: string; phone: string; sortOrder: number },
  alreadyInFirestore: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const cleanId = item.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  if (!cleanId) throw new Error('Invalid reference ID.');
  if (!item.name.trim() || !item.role.trim() || !item.phone.trim()) {
    throw new Error('Name, role, and phone are required.');
  }

  const payload = {
    name: item.name.trim().slice(0, 120),
    role: item.role.trim().slice(0, 140),
    phone: item.phone.trim().slice(0, 40),
    sortOrder: Math.max(0, Math.min(1000, Math.round(Number(item.sortOrder) || 0))),
  };

  try {
    if (alreadyInFirestore) {
      await updateDoc(doc(db, 'references', cleanId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'references', cleanId), {
        ...payload,
        authorId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE, `references/${cleanId}`);
  }
}

export async function deleteReferenceFromFirestore(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentication required.');
  try {
    await deleteDoc(doc(db, 'references', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `references/${id}`);
  }
}

export function compressPortraitImage(file: File, maxDimension = 560): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image (JPG, PNG, or WebP).'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Image size must be 12 MB or smaller.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = Math.floor((img.width - size) / 2);
        const sy = Math.floor((img.height - size) / 2);
        const target = Math.min(size, maxDimension);

        const canvas = document.createElement('canvas');
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, sx, sy, size, size, 0, 0, target, target);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 520_000 && quality > 0.4) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
