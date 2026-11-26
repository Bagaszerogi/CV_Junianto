import {
  collection,
  deleteDoc,
  doc,
  DocumentReference,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  CV_PROFILE,
  EDUCATION,
  KEY_METRICS,
  REFERENCES,
  TECH_STACK,
  UI_COPY,
  type ReferenceItem,
  type TechCategory,
} from '../data/cvData';
import { isValidEmailAddress, sanitizePortraitSrc } from './safeUrls';
import {
  readCvIndex,
  registerEntityInCvIndex,
  schedulePublishedSnapshotSync,
} from './inviteApi';
import { syncAdminRecord } from './projectApi';

export interface SiteCopyLocale {
  navProfile: string;
  navExperience: string;
  navProjects: string;
  navStack: string;
  navContact: string;
  downloadPdf: string;
  heroActiveBadge: string;
  heroPropertyScale: string;
  heroDossierFooter: string;
  heroSendEmail: string;
  experienceKicker: string;
  experienceTitle: string;
  experienceDesc: string;
  projectsKicker: string;
  projectsTitle: string;
  projectsDesc: string;
  stackKicker: string;
  stackTitle: string;
  stackDesc: string;
  educationKicker: string;
  educationTitle: string;
  referencesKicker: string;
  referencesTitle: string;
  referencesNote: string;
  contactKicker: string;
  contactTitle: string;
  contactDesc: string;
  composerTitle: string;
  composerDesc: string;
  footerNote: string;
}

export interface SiteContentData {
  en: SiteCopyLocale;
  id: SiteCopyLocale;
  fromFirestore: boolean;
}

export const DEFAULT_SITE_CONTENT: SiteContentData = {
  en: {
    navProfile: UI_COPY.en.nav.profile,
    navExperience: UI_COPY.en.nav.experience,
    navProjects: UI_COPY.en.nav.projects,
    navStack: UI_COPY.en.nav.stack,
    navContact: UI_COPY.en.nav.contact,
    downloadPdf: UI_COPY.en.downloadPdf,
    heroActiveBadge: 'Active Assignment',
    heroPropertyScale: '336 Rooms · 15 Meeting Rooms · 2 Ballrooms',
    heroDossierFooter: 'A4 Executive Print Ready',
    heroSendEmail: 'Send Email',
    experienceKicker: UI_COPY.en.sections.experienceKicker,
    experienceTitle: UI_COPY.en.sections.experienceTitle,
    experienceDesc: UI_COPY.en.sections.experienceDesc,
    projectsKicker: UI_COPY.en.sections.projectsKicker,
    projectsTitle: UI_COPY.en.sections.projectsTitle,
    projectsDesc: UI_COPY.en.sections.projectsDesc,
    stackKicker: UI_COPY.en.sections.stackKicker,
    stackTitle: UI_COPY.en.sections.stackTitle,
    stackDesc: UI_COPY.en.sections.stackDesc,
    educationKicker: UI_COPY.en.sections.educationKicker,
    educationTitle: UI_COPY.en.sections.educationTitle,
    referencesKicker: UI_COPY.en.sections.referencesKicker,
    referencesTitle: UI_COPY.en.sections.referencesTitle,
    referencesNote: UI_COPY.en.sections.referencesNote,
    contactKicker: UI_COPY.en.sections.contactKicker,
    contactTitle: UI_COPY.en.sections.contactTitle,
    contactDesc: UI_COPY.en.sections.contactDesc,
    composerTitle: 'Quick Message Composer',
    composerDesc: 'Compose your inquiry and launch directly in your email client or WhatsApp.',
    footerNote: 'Hospitality IT Infrastructure & Operations Portfolio',
  },
  id: {
    navProfile: UI_COPY.id.nav.profile,
    navExperience: UI_COPY.id.nav.experience,
    navProjects: UI_COPY.id.nav.projects,
    navStack: UI_COPY.id.nav.stack,
    navContact: UI_COPY.id.nav.contact,
    downloadPdf: UI_COPY.id.downloadPdf,
    heroActiveBadge: 'Penugasan Aktif',
    heroPropertyScale: '336 Kamar · 15 Ruang Rapat · 2 Ballroom',
    heroDossierFooter: 'Siap Cetak Format A4',
    heroSendEmail: 'Kirim Email',
    experienceKicker: UI_COPY.id.sections.experienceKicker,
    experienceTitle: UI_COPY.id.sections.experienceTitle,
    experienceDesc: UI_COPY.id.sections.experienceDesc,
    projectsKicker: UI_COPY.id.sections.projectsKicker,
    projectsTitle: UI_COPY.id.sections.projectsTitle,
    projectsDesc: UI_COPY.id.sections.projectsDesc,
    stackKicker: UI_COPY.id.sections.stackKicker,
    stackTitle: UI_COPY.id.sections.stackTitle,
    stackDesc: UI_COPY.id.sections.stackDesc,
    educationKicker: UI_COPY.id.sections.educationKicker,
    educationTitle: UI_COPY.id.sections.educationTitle,
    referencesKicker: UI_COPY.id.sections.referencesKicker,
    referencesTitle: UI_COPY.id.sections.referencesTitle,
    referencesNote: UI_COPY.id.sections.referencesNote,
    contactKicker: UI_COPY.id.sections.contactKicker,
    contactTitle: UI_COPY.id.sections.contactTitle,
    contactDesc: UI_COPY.id.sections.contactDesc,
    composerTitle: 'Kirim Pesan Cepat',
    composerDesc: 'Tulis pesan Anda dan kirim langsung melalui aplikasi Email atau WhatsApp.',
    footerNote: 'Portofolio Infrastruktur & Operasional IT Perhotelan',
  },
  fromFirestore: false,
};

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
  if (!auth.currentUser) return () => {};
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
        kickerEn:
          typeof d.kickerEn === 'string'
            ? d.kickerEn.replace(/Harvard-Standard Curriculum Vitae/gi, 'Executive Curriculum Vitae')
            : DEFAULT_PROFILE_DATA.kickerEn,
        kickerId:
          typeof d.kickerId === 'string'
            ? d.kickerId.replace(/Curriculum Vitae Standar Harvard/gi, 'Curriculum Vitae Profesional')
            : DEFAULT_PROFILE_DATA.kickerId,
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
      if (!auth.currentUser) return;
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
    portraitDataUrl: sanitizePortraitSrc(profile.portraitDataUrl, ''),
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

  const docRef = doc(db, 'profile', 'main');
  try {
    await upsertFirestoreDoc(docRef, payload, 'profile/main');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(
      error,
      alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE,
      'profile/main'
    );
  }
}

export async function upsertFirestoreDoc(
  docRef: DocumentReference,
  payload: Record<string, unknown>,
  _path: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const runWrite = async (): Promise<void> => {
    const snap = await getDocFromServer(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        ...payload,
        authorId: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const existing = snap.data();
    const preservedAuthorId =
      typeof existing?.authorId === 'string' && existing.authorId.length > 0
        ? existing.authorId
        : currentUser.uid;
    const hasValidCreatedAt =
      existing?.createdAt instanceof Timestamp ||
      typeof existing?.createdAt?.toMillis === 'function';
    const preservedCreatedAt = hasValidCreatedAt
      ? existing.createdAt
      : serverTimestamp();

    await setDoc(docRef, {
      ...payload,
      authorId: preservedAuthorId,
      createdAt: preservedCreatedAt,
      updatedAt: serverTimestamp(),
    });
  };

  try {
    await runWrite();
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (msg.includes('permission') || msg.includes('insufficient')) {
      await currentUser.getIdToken(true).catch(() => undefined);
      await syncAdminRecord(currentUser).catch(() => undefined);
      await runWrite();
      return;
    }
    throw err;
  }
}

export function subscribeTechStacks(
  onData: (items: FirestoreTechCategory[]) => void,
  onError: (err: Error) => void
): () => void {
  if (!auth.currentUser) return () => {};
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
      if (!auth.currentUser) return;
      void (async () => {
        const idx = await readCvIndex();
        if (idx) {
          const mergedMap = new Map<string, FirestoreTechCategory>();
          TECH_STACK.forEach((item, i) => {
            mergedMap.set(item.id, { ...item, sortOrder: i, fromFirestore: false });
          });
          await Promise.all(
            idx.techStackIds.map(async (id) => {
              try {
                const snap = await getDocFromServer(doc(db, 'techStacks', id));
                if (!snap.exists()) return;
                const d = snap.data();
                mergedMap.set(snap.id, {
                  id: snap.id,
                  group: VALID_TECH_GROUPS.has(d.group as TechCategory['group'])
                    ? (d.group as TechCategory['group'])
                    : 'core',
                  label: typeof d.label === 'string' ? d.label : '',
                  labelId:
                    typeof d.labelId === 'string'
                      ? d.labelId
                      : typeof d.label === 'string'
                        ? d.label
                        : '',
                  items: Array.isArray(d.items)
                    ? d.items.filter((x): x is string => typeof x === 'string')
                    : [],
                  sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 99,
                  fromFirestore: true,
                });
              } catch {
                // Ignore
              }
            })
          );
          onData(Array.from(mergedMap.values()).sort((a, b) => a.sortOrder - b.sortOrder));
          return;
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'techStacks');
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      })();
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
    await upsertFirestoreDoc(doc(db, 'techStacks', cleanId), payload, `techStacks/${cleanId}`);
    await registerEntityInCvIndex('techStackIds', cleanId, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE, `techStacks/${cleanId}`);
  }
}

export async function deleteTechStackFromFirestore(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentication required.');
  try {
    await deleteDoc(doc(db, 'techStacks', id));
    await registerEntityInCvIndex('techStackIds', id, 'remove');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `techStacks/${id}`);
  }
}

export function subscribeReferences(
  onData: (items: FirestoreReferenceItem[]) => void,
  onError: (err: Error) => void
): () => void {
  if (!auth.currentUser) return () => {};
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
      if (!auth.currentUser) return;
      void (async () => {
        const idx = await readCvIndex();
        if (idx) {
          const mergedMap = new Map<string, FirestoreReferenceItem>();
          REFERENCES.forEach((r, i) => {
            mergedMap.set(`ref_default_${i}`, {
              ...r,
              id: `ref_default_${i}`,
              sortOrder: i,
              fromFirestore: false,
            });
          });
          await Promise.all(
            idx.referenceIds.map(async (id) => {
              try {
                const snap = await getDocFromServer(doc(db, 'references', id));
                if (!snap.exists()) return;
                const d = snap.data();
                const phone = typeof d.phone === 'string' ? d.phone : '';
                const digits = phone.replace(/\D/g, '');
                const phoneHref = digits.startsWith('0')
                  ? `tel:+62${digits.slice(1)}`
                  : digits
                    ? `tel:+${digits}`
                    : '#';
                mergedMap.set(snap.id, {
                  id: snap.id,
                  name: typeof d.name === 'string' ? d.name : '',
                  role: typeof d.role === 'string' ? d.role : '',
                  phone,
                  phoneHref,
                  sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 99,
                  fromFirestore: true,
                });
              } catch {
                // Ignore
              }
            })
          );
          onData(Array.from(mergedMap.values()).sort((a, b) => a.sortOrder - b.sortOrder));
          return;
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'references');
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      })();
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
    await upsertFirestoreDoc(doc(db, 'references', cleanId), payload, `references/${cleanId}`);
    await registerEntityInCvIndex('referenceIds', cleanId, 'add');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE, `references/${cleanId}`);
  }
}

export async function deleteReferenceFromFirestore(id: string): Promise<void> {
  if (!auth.currentUser) throw new Error('Authentication required.');
  try {
    await deleteDoc(doc(db, 'references', id));
    await registerEntityInCvIndex('referenceIds', id, 'remove');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `references/${id}`);
  }
}

function detectHasTransparency(img: HTMLImageElement): boolean {
  try {
    const probeW = Math.min(64, Math.max(1, img.width));
    const probeH = Math.min(64, Math.max(1, img.height));
    const probeCanvas = document.createElement('canvas');
    probeCanvas.width = probeW;
    probeCanvas.height = probeH;
    const probeCtx = probeCanvas.getContext('2d');
    if (!probeCtx) return false;
    probeCtx.clearRect(0, 0, probeW, probeH);
    probeCtx.drawImage(img, 0, 0, probeW, probeH);
    const { data } = probeCtx.getImageData(0, 0, probeW, probeH);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 245) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function renderPortraitCanvas(
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  isTransparentCutout: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context unavailable.');
  }
  ctx.clearRect(0, 0, targetW, targetH);

  const srcRatio = img.width / Math.max(1, img.height);
  const dstRatio = targetW / targetH; // 4:5 = 0.8

  if (isTransparentCutout) {
    // Fit entire transparent PNG cutout cleanly inside 4:5 frame anchored at bottom
    let drawW = targetW;
    let drawH = targetH;
    if (srcRatio > dstRatio) {
      drawW = targetW;
      drawH = Math.round(targetW / srcRatio);
    } else {
      drawH = targetH;
      drawW = Math.round(targetH * srcRatio);
    }
    const dx = Math.round((targetW - drawW) / 2);
    const dy = Math.round(targetH - drawH);
    ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, drawW, drawH);
    return canvas;
  }

  // Cover-crop standard photos cleanly to 4:5 with top portrait headroom bias
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (srcRatio > dstRatio) {
    sw = Math.round(img.height * dstRatio);
    sx = Math.max(0, Math.round((img.width - sw) / 2));
  } else {
    sh = Math.round(img.width / dstRatio);
    sy = Math.max(0, Math.round((img.height - sh) * 0.14));
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas;
}

export function compressPortraitImage(file: File, maxHeight = 800): Promise<string> {
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
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        try {
          const isPngOrWebp =
            file.type === 'image/png' || file.type === 'image/webp';
          const hasAlpha = isPngOrWebp && detectHasTransparency(img);
          const preserveAlpha = hasAlpha || file.type === 'image/png';

          const sizes: Array<[number, number]> = [
            [Math.round(maxHeight * 0.8), maxHeight], // 640x800
            [480, 600],
            [384, 480],
            [320, 400],
          ];

          for (const [w, h] of sizes) {
            const canvas = renderPortraitCanvas(img, w, h, preserveAlpha);
            if (preserveAlpha) {
              // WebP supports full RGBA alpha transparency at ~5x smaller size than PNG
              for (let q = 0.9; q >= 0.45; q -= 0.1) {
                const webpUrl = canvas.toDataURL('image/webp', Number(q.toFixed(2)));
                if (webpUrl.startsWith('data:image/webp;') && webpUrl.length <= 720_000) {
                  resolve(webpUrl);
                  return;
                }
              }
              const pngUrl = canvas.toDataURL('image/png');
              if (pngUrl.length <= 720_000) {
                resolve(pngUrl);
                return;
              }
            } else {
              for (let q = 0.86; q >= 0.4; q -= 0.1) {
                const jpgUrl = canvas.toDataURL('image/jpeg', Number(q.toFixed(2)));
                if (jpgUrl.length <= 720_000) {
                  resolve(jpgUrl);
                  return;
                }
              }
            }
          }

          reject(
            new Error(
              'Portrait image is still too large after compression. Please choose a smaller PNG/JPG file.'
            )
          );
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const SITE_COPY_LIMITS: Record<keyof SiteCopyLocale, number> = {
  navProfile: 40,
  navExperience: 40,
  navProjects: 40,
  navStack: 40,
  navContact: 40,
  downloadPdf: 80,
  heroActiveBadge: 60,
  heroPropertyScale: 140,
  heroDossierFooter: 100,
  heroSendEmail: 50,
  experienceKicker: 80,
  experienceTitle: 120,
  experienceDesc: 400,
  projectsKicker: 80,
  projectsTitle: 120,
  projectsDesc: 400,
  stackKicker: 80,
  stackTitle: 120,
  stackDesc: 400,
  educationKicker: 80,
  educationTitle: 120,
  referencesKicker: 80,
  referencesTitle: 120,
  referencesNote: 300,
  contactKicker: 80,
  contactTitle: 120,
  contactDesc: 400,
  composerTitle: 120,
  composerDesc: 300,
  footerNote: 240,
};

function normalizeLegacyHarvardCopy(key: keyof SiteCopyLocale, val: string): string {
  if (key === 'downloadPdf' && /harvard/i.test(val)) {
    return /cetak|simpan|unduh/i.test(val) ? 'Unduh PDF' : 'Download PDF';
  }
  if (key === 'heroDossierFooter' && /harvard/i.test(val)) {
    return /siap cetak/i.test(val) ? 'Siap Cetak Format A4' : 'A4 Executive Print Ready';
  }
  return val;
}

function sanitizeLocaleCopy(
  raw: Record<string, unknown> | undefined,
  fallback: SiteCopyLocale
): SiteCopyLocale {
  const result = { ...fallback };
  (Object.keys(SITE_COPY_LIMITS) as (keyof SiteCopyLocale)[]).forEach((key) => {
    const val = raw?.[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      const cleaned = normalizeLegacyHarvardCopy(key, val.trim());
      result[key] = cleaned.slice(0, SITE_COPY_LIMITS[key]);
    }
  });
  return result;
}

export function subscribeSiteContent(
  onData: (data: SiteContentData) => void,
  onError: (err: Error) => void
): () => void {
  if (!auth.currentUser) return () => {};
  const ref = doc(db, 'siteContent', 'main');
  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData({ ...DEFAULT_SITE_CONTENT, fromFirestore: false });
        return;
      }
      const d = snapshot.data();
      const rawEn = typeof d.en === 'object' && d.en !== null ? (d.en as Record<string, unknown>) : undefined;
      const rawId = typeof d.id === 'object' && d.id !== null ? (d.id as Record<string, unknown>) : undefined;
      onData({
        en: sanitizeLocaleCopy(rawEn, DEFAULT_SITE_CONTENT.en),
        id: sanitizeLocaleCopy(rawId, DEFAULT_SITE_CONTENT.id),
        fromFirestore: true,
      });
    },
    (error) => {
      if (!auth.currentUser) return;
      try {
        handleFirestoreError(error, OperationType.GET, 'siteContent/main');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveSiteContentToFirestore(
  data: SiteContentData,
  alreadyInFirestore: boolean
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required.');

  const en = sanitizeLocaleCopy(data.en as unknown as Record<string, unknown>, DEFAULT_SITE_CONTENT.en);
  const id = sanitizeLocaleCopy(data.id as unknown as Record<string, unknown>, DEFAULT_SITE_CONTENT.id);

  try {
    await upsertFirestoreDoc(doc(db, 'siteContent', 'main'), { en, id }, 'siteContent/main');
    schedulePublishedSnapshotSync();
  } catch (error) {
    handleFirestoreError(
      error,
      alreadyInFirestore ? OperationType.UPDATE : OperationType.CREATE,
      'siteContent/main'
    );
  }
}
