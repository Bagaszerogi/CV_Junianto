export type Locale = 'en' | 'id';

export type ExperienceStatus = 'active' | 'completed';

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  roleId: string;
  status: ExperienceStatus;
  category: 'leadership' | 'operations';
  period: string;
  periodId: string;
  scaleContext: string;
  scaleContextId: string;
  bullets: string[];
  bulletsId: string[];
  systems: string[];
  sortOrder: number;
}

export interface TechCategory {
  id: string;
  group: 'core' | 'infra' | 'guest' | 'productivity';
  label: string;
  labelId: string;
  items: string[];
}

export interface ReferenceItem {
  name: string;
  role: string;
  phone: string;
  phoneHref: string;
}

export const CV_PROFILE = {
  name: 'Junianto Bagas Prasetyo',
  brandShort: 'Junianto Bagas',
  title: {
    en: 'IT Infrastructure & Hospitality Systems Specialist',
    id: 'Spesialis Infrastruktur IT & Sistem Perhotelan',
  },
  kicker: {
    en: 'Harvard-Standard Curriculum Vitae · Hospitality IT Operations',
    id: 'Curriculum Vitae Standar Harvard · Operasional IT Perhotelan',
  },
  currentRole: {
    company: 'Hotel Ciputra Jakarta',
    role: 'Information Technology Supervisor',
  },
  summary: {
    en: 'Results-driven Hospitality IT Supervisor with 5+ years of hands-on experience (2020–Present) aligning enterprise network infrastructure, virtualization environments, and hotel technology ecosystems with seamless operational workflows and guest experiences. Proven track record in leading end-to-end IT operations for 300+ room properties, strengthening multi-layered network security, and resolving complex system bottlenecks under 24/7 high-demand hospitality environments.',
    id: 'Hospitality IT Supervisor berorientasi hasil dengan pengalaman lebih dari 5 tahun (2020–Sekarang) dalam menyelaraskan infrastruktur jaringan enterprise, lingkungan virtualisasi, dan ekosistem teknologi perhotelan untuk mendukung operasional 24/7 serta pengalaman tamu terbaik. Terbukti memimpin operasional IT end-to-end pada properti berkapasitas 300+ kamar, memperkuat keamanan jaringan berlapis, dan menyelesaikan kendala sistem kompleks secara cepat lintas departemen.',
  },
  contact: {
    phoneDisplay: '+62 812-2556-0408',
    whatsappHref: 'https://wa.me/6281225560408',
    email: 'bagaszerogi@gmail.com',
    address: 'Sleman, Yogyakarta / Jakarta, Indonesia',
  },
  portraitSrc: '/assets/portrait.png',
};

export const KEY_METRICS = [
  {
    value: '5+ Years',
    valueId: '5+ Tahun',
    label: 'Hospitality IT Experience',
    labelId: 'Pengalaman IT Perhotelan',
    detail: '2020–Present · 24/7 hotel ops',
    detailId: '2020–Sekarang · Operasional 24/7',
  },
  {
    value: '336 Rooms',
    valueId: '336 Kamar',
    label: 'Flagship Property Scale',
    labelId: 'Skala Properti Utama',
    detail: '15 meeting rooms & 2 ballrooms',
    detailId: '15 ruang rapat & 2 ballroom',
  },
  {
    value: '345+ APs',
    valueId: '345+ AP',
    label: 'Managed Wi-Fi Footprint',
    labelId: 'Cakupan Wi-Fi Terkelola',
    detail: 'UniFi, Ruijie, Meraki & Fortigate',
    detailId: 'UniFi, Ruijie, Meraki & Fortigate',
  },
  {
    value: '99.9%',
    valueId: '99.9%',
    label: 'PMS & Check-in Uptime',
    labelId: 'Ketersediaan PMS & Check-in',
    detail: 'Protel, VHP, XNPOS & Onity locks',
    detailId: 'Protel, VHP, XNPOS & kunci Onity',
  },
];

export const EDUCATION = {
  institution: 'Universitas Mercu Buana Yogyakarta',
  major: {
    en: 'Bachelor of Computer Science (Informatika)',
    id: 'S1 Teknik Informatika (Ilmu Komputer)',
  },
  period: '2015 – 2020',
  gpa: 'GPA: 3.50 / 4.00',
  gpaId: 'IPK: 3,50 / 4,00',
  focus: {
    en: 'Focused on enterprise network engineering, database administration, virtualization systems, and full-cycle software & IT infrastructure operations.',
    id: 'Berfokus pada rekayasa jaringan enterprise, administrasi basis data, sistem virtualisasi, serta operasional infrastruktur IT dan pengembangan perangkat lunak.',
  },
};

export const EXPERIENCES: ExperienceItem[] = [
  {
    id: 'exp-ciputra-jakarta',
    company: 'Hotel Ciputra Jakarta',
    role: 'Information Technology Supervisor',
    roleId: 'Information Technology Supervisor',
    status: 'active',
    category: 'leadership',
    period: 'Jul 2023 – Present',
    periodId: 'Jul 2023 – Sekarang',
    scaleContext: 'Jakarta, Indonesia · 336 Rooms, 15 Meeting Rooms & 2 Ballrooms',
    scaleContextId: 'Jakarta, Indonesia · 336 Kamar, 15 Ruang Rapat & 2 Ballroom',
    bullets: [
      'Direct end-to-end IT infrastructure, system compliance, and daily technical operations for a 336-room luxury property featuring 15 meeting rooms and 2 ballrooms.',
      'Architect and maintain mission-critical hospitality applications, including Protel Property Management System (PMS), XNPOS (F&B Point of Sale), SAGE Back Office Finance, and VMware vSphere virtualization environments.',
      'Harden property network security via Fortigate Firewall configuration and manage 345+ UniFi and Ruijie wireless access points to ensure uninterrupted high-speed Wi-Fi coverage across all guest and administration zones.',
      'Streamline cross-departmental operations and digital guest touchpoints by implementing automated tools, including SARA apps, Majoo, GoDesk, and centralized digital signage platforms (DigiSign, MagicInfo, CDMS).',
    ],
    bulletsId: [
      'Memimpin infrastruktur IT end-to-end, kepatuhan sistem, dan operasional teknis harian untuk properti 336 kamar dengan 15 ruang rapat dan 2 ballroom.',
      'Mengelola dan memelihara aplikasi inti perhotelan meliputi Protel PMS, XNPOS (F&B POS), SAGE Back Office Finance, serta lingkungan virtualisasi VMware vSphere.',
      'Memperkuat keamanan jaringan properti melalui konfigurasi Fortigate Firewall serta mengelola 345+ access point UniFi dan Ruijie demi koneksi Wi-Fi stabil bagi tamu dan operasional.',
      'Mengoptimalkan alur kerja lintas departemen dan layanan digital tamu melalui aplikasi SARA, Majoo, GoDesk, serta platform digital signage terpusat (DigiSign, MagicInfo, CDMS).',
    ],
    systems: [
      'Protel PMS',
      'XNPOS',
      'SAGE Finance',
      'VMware vSphere',
      'Fortigate Firewall',
      'UniFi & Ruijie (345+ AP)',
      'SARA & GoDesk',
      'DigiSign / MagicInfo / CDMS',
    ],
    sortOrder: 0,
  },
  {
    id: 'exp-fave-kusumanegara',
    company: 'Fave Hotel Kusumanegara',
    role: 'Information Technology Officer & Graphic Design',
    roleId: 'Information Technology Officer & Desain Grafis',
    status: 'completed',
    category: 'operations',
    period: 'Oct 2021 – Jul 2023',
    periodId: 'Okt 2021 – Jul 2023',
    scaleContext: 'Yogyakarta, Indonesia · 115 Guest Rooms, PMS & Surveillance',
    scaleContextId: 'Yogyakarta, Indonesia · 115 Kamar Tamu, PMS & Pengawasan',
    bullets: [
      'Administered VHP Property Management System and Onity electronic keycard door lock infrastructure across 115 guest rooms, guaranteeing 99.9% check-in system availability.',
      'Oversaw property-wide CCTV IP camera surveillance networks, in-house TV distribution channels, and Cisco Meraki / Ruijie switching hardware.',
      'Executed preventive hardware maintenance schedules and rapid level-2 incident troubleshooting for front-office, administrative, and guest-facing technology touchpoints.',
      'Designed internal and promotional visual assets using Adobe Creative Suite to align branding across digital and print collateral.',
    ],
    bulletsId: [
      'Mengelola VHP Property Management System dan infrastruktur kunci pintu kartu elektronik Onity untuk 115 kamar tamu dengan ketersediaan sistem check-in 99,9%.',
      'Mengawasi jaringan kamera pengawas IP CCTV seluruh properti, sistem distribusi TV in-house, serta perangkat switching Cisco Meraki dan Ruijie.',
      'Melaksanakan jadwal pemeliharaan preventif perangkat keras serta penanganan insiden level-2 secara cepat untuk front-office, administrasi, dan teknologi tamu.',
      'Merancang materi visual internal maupun promosi menggunakan Adobe Creative Suite agar konsisten di seluruh media digital dan cetak.',
    ],
    systems: [
      'VHP PMS',
      'Onity Door Locks',
      'Cisco Meraki',
      'Ruijie Switches',
      'Hikvision CCTV',
      'Adobe Creative Suite',
    ],
    sortOrder: 1,
  },
  {
    id: 'exp-liquid-next-gen',
    company: 'Liquid Next Generation',
    role: 'Information Technology Officer',
    roleId: 'Information Technology Officer',
    status: 'completed',
    category: 'operations',
    period: 'Dec 2020 – Oct 2021',
    periodId: 'Des 2020 – Okt 2021',
    scaleContext: 'Yogyakarta, Indonesia · High-Volume Venue, Servers & POS',
    scaleContextId: 'Yogyakarta, Indonesia · Venue Volume Tinggi, Server & POS',
    bullets: [
      'Maintained and optimized high-speed internet connectivity and LAN routing across all venue operational areas to eliminate transaction bottlenecks during peak operational hours.',
      'Administered and monitored local physical server infrastructure to ensure 24/7 uptime for central databases and billing systems.',
      'Configured, deployed, and supported high-volume Point-of-Sale (POS) terminals for rapid daily transaction processing.',
    ],
    bulletsId: [
      'Memelihara dan mengoptimalkan konektivitas internet berkecepatan tinggi serta routing LAN di seluruh area operasional guna mencegah hambatan transaksi saat jam sibuk.',
      'Mengelola dan memantau infrastruktur server fisik lokal untuk menjaga uptime 24/7 bagi basis data pusat dan sistem billing.',
      'Mengonfigurasi, menerapkan, dan mendukung terminal Point-of-Sale (POS) bervolume tinggi untuk kelancaran transaksi harian.',
    ],
    systems: ['LAN Routing', 'Physical Servers', 'High-Volume POS', 'Database & Billing'],
    sortOrder: 2,
  },
];

export const TECH_STACK: TechCategory[] = [
  {
    id: 'stack-hospitality-systems',
    group: 'core',
    label: 'Hospitality & Business Systems',
    labelId: 'Sistem Perhotelan & Bisnis',
    items: [
      'Protel PMS',
      'VHP PMS',
      'XNPOS (F&B POS)',
      'SAGE (Back Office)',
      'Majoo',
      'GoDesk & SARA Apps',
      'Samsung LinkReach',
      'DigiSign / MagicInfo / CDMS',
    ],
  },
  {
    id: 'stack-network-security',
    group: 'infra',
    label: 'Infrastructure, Network & Security',
    labelId: 'Infrastruktur, Jaringan & Keamanan',
    items: [
      'Fortigate Firewall',
      'Cisco Meraki',
      'UniFi & Ruijie APs',
      'VMware vSphere',
      'ESET Endpoint Security',
      'Miwa & Onity Lock Systems',
      'Hikvision CCTV Networks',
      'PABX (Trancel)',
    ],
  },
  {
    id: 'stack-core-competencies',
    group: 'guest',
    label: 'Core Management & Audit Competencies',
    labelId: 'Kompetensi Manajemen & Audit',
    items: [
      'Root-Cause Problem Solving',
      'Incident & Crisis Management',
      'Cross-Departmental Communication',
      'Vendor & SLA Management',
      'IT Compliance & Audit Readiness',
      'Preventive Maintenance Planning',
    ],
  },
  {
    id: 'stack-productivity-design',
    group: 'productivity',
    label: 'Productivity, Messaging & Design',
    labelId: 'Produktivitas, Email & Desain',
    items: [
      'Google Workspace (Advanced Analytics)',
      'MDaemon Mail Server',
      'Adobe Creative Suite',
      'Canva',
    ],
  },
];

export const REFERENCES: ReferenceItem[] = [
  {
    name: 'Kasanova Hermawan',
    role: 'GM Cluster — Hotel Aston Cilacap',
    phone: '0877-3919-9722',
    phoneHref: 'tel:+6287739199722',
  },
  {
    name: 'Arum Sekar Rahajeng',
    role: 'HR Manager — AVEON Hotel',
    phone: '0878-7770-7000',
    phoneHref: 'tel:+6287877707000',
  },
  {
    name: 'Wahyu Andriwibowo',
    role: 'IT — Vasa Hotel',
    phone: '0856-4545-8553',
    phoneHref: 'tel:+6285645458553',
  },
  {
    name: 'Kiki Vindian',
    role: 'Financial Controller — Hotel Malioboro',
    phone: '0822-8147-7405',
    phoneHref: 'tel:+6282281477405',
  },
];

export const UI_COPY = {
  en: {
    nav: {
      profile: 'Profile',
      experience: 'Experience',
      projects: 'Projects',
      stack: 'Skills',
      contact: 'Contact',
    },
    downloadPdf: 'Download / Print Harvard CV',
    sections: {
      experienceKicker: 'Career Timeline',
      experienceTitle: 'Professional Experience',
      experienceDesc:
        'End-to-end hospitality IT leadership, enterprise network administration, and 24/7 property systems operations.',
      filters: {
        all: 'All Roles',
        leadership: 'Leadership',
        operations: 'IT Officer',
      },
      projectsKicker: 'Field Portfolio',
      projectsTitle: 'Infrastructure & Rollout Projects',
      projectsDesc:
        'Documented hotel network upgrades, server virtualization deployments, CCTV grids, and guest technology rollouts.',
      stackKicker: 'Technical Capabilities',
      stackTitle: 'Skills & Core Competencies',
      stackDesc:
        'Hospitality PMS/POS ecosystems, multi-layered network security, virtualization, and IT service governance.',
      stackFilters: {
        all: 'All Skills',
        core: 'Hospitality Systems',
        infra: 'Infra & Security',
        guest: 'Core Competencies',
        productivity: 'Tools & Design',
      },
      educationKicker: 'Academic Background',
      educationTitle: 'Education',
      referencesKicker: 'Direct Verification',
      referencesTitle: 'Professional References',
      referencesNote: 'Executive and hospitality peers available for direct reference verification.',
      contactKicker: 'Direct Contact',
      contactTitle: 'Let’s Connect',
      contactDesc:
        'Available for Hospitality IT leadership roles, pre-opening infrastructure architecture, and hotel systems consulting.',
    },
  },
  id: {
    nav: {
      profile: 'Profil',
      experience: 'Pengalaman',
      projects: 'Proyek',
      stack: 'Keahlian',
      contact: 'Kontak',
    },
    downloadPdf: 'Cetak / Simpan CV Harvard',
    sections: {
      experienceKicker: 'Rekam Jejak Karier',
      experienceTitle: 'Pengalaman Profesional',
      experienceDesc:
        'Kepemimpinan IT perhotelan end-to-end, administrasi jaringan enterprise, dan operasional sistem properti 24/7.',
      filters: {
        all: 'Semua Posisi',
        leadership: 'Kepemimpinan',
        operations: 'IT Officer',
      },
      projectsKicker: 'Portofolio Lapangan',
      projectsTitle: 'Proyek Infrastruktur & Implementasi',
      projectsDesc:
        'Dokumentasi pembaruan jaringan hotel, virtualisasi server, jaringan CCTV, dan teknologi layanan tamu.',
      stackKicker: 'Kapabilitas Teknis',
      stackTitle: 'Keahlian & Kompetensi Inti',
      stackDesc:
        'Ekosistem PMS/POS perhotelan, keamanan jaringan berlapis, virtualisasi, dan tata kelola layanan IT.',
      stackFilters: {
        all: 'Semua Keahlian',
        core: 'Sistem Hotel',
        infra: 'Infra & Keamanan',
        guest: 'Kompetensi Inti',
        productivity: 'Alat & Desain',
      },
      educationKicker: 'Latar Belakang Akademik',
      educationTitle: 'Pendidikan',
      referencesKicker: 'Verifikasi Langsung',
      referencesTitle: 'Referensi Profesional',
      referencesNote: 'Pimpinan dan rekan industri perhotelan yang siap dihubungi untuk verifikasi.',
      contactKicker: 'Kontak Langsung',
      contactTitle: 'Mari Terhubung',
      contactDesc:
        'Terbuka untuk posisi kepemimpinan IT perhotelan, arsitektur infrastruktur pre-opening, dan konsultasi sistem hotel.',
    },
  },
} as const;
