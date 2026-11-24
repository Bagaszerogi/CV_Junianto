import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

type ProjectCategory = 'infrastructure' | 'pms-pos' | 'security' | 'event-av';

interface StoredProject {
  id: string;
  title: string;
  property: string;
  year: string;
  category: ProjectCategory;
  description: string;
  imageDataUrl: string;
  createdAt: number;
}

interface AdminCredentialRecord {
  email: string;
  salt: string;
  hash: string;
  updatedAt: number;
}

interface StoreData {
  adminCredential: AdminCredentialRecord | null;
  projects: StoredProject[];
}

const VALID_CATEGORIES = new Set<ProjectCategory>([
  'infrastructure',
  'pms-pos',
  'security',
  'event-av',
]);

const DATA_IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const MAX_REVOKED_TOKENS = 2000;
const revokedTokens = new Set<string>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const STORE_FILE = process.env.VERCEL
  ? path.resolve('/tmp', 'jbp-cv-store.json')
  : path.resolve(process.cwd(), '.runtime-data', 'store.json');

function ensureStoreDirectory(): void {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore(): StoreData {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      return { adminCredential: null, projects: [] };
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      adminCredential: parsed.adminCredential ?? null,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return { adminCredential: null, projects: [] };
  }
}

function writeStore(data: StoreData): void {
  ensureStoreDirectory();
  const tmpFile = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_FILE);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString('hex');
}

function safeEqualHex(aHex: string, bHex: string): boolean {
  const aBuf = Buffer.from(aHex, 'hex');
  const bBuf = Buffer.from(bHex, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function safeEqualText(a: string, b: string): boolean {
  const aDigest = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bDigest = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(aDigest, bDigest);
}

function getEnvAdminConfig(): { email: string; password: string; misconfigured?: boolean } | null {
  const envPassword = process.env.ADMIN_PASSWORD?.trim() ?? '';
  const envEmail = process.env.ADMIN_EMAIL?.trim() ?? '';
  if (!envPassword) {
    return null;
  }
  if (!EMAIL_RE.test(envEmail)) {
    return {
      email: '',
      password: envPassword,
      misconfigured: true,
    };
  }
  return {
    email: normalizeEmail(envEmail),
    password: envPassword,
  };
}

function signSessionToken(email: string): string {
  const payload = {
    sub: email,
    jti: crypto.randomUUID(),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token: string): { email: string; jti: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqualText(signature, expectedSig)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as { sub?: unknown; jti?: unknown; exp?: unknown };
    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > decoded.exp || revokedTokens.has(decoded.jti)) {
      return null;
    }
    return { email: decoded.sub, jti: decoded.jti };
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
}

interface AuthenticatedRequest extends Request {
  adminUser?: { email: string; jti: string };
}

function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const verified = verifySessionToken(token);
  if (!verified) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }
  req.adminUser = verified;
  next();
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (loginAttempts.size > 1000) {
    for (const [key, entry] of loginAttempts.entries()) {
      if (now > entry.resetAt) {
        loginAttempts.delete(key);
      }
    }
  }
  const existing = loginAttempts.get(ip);
  if (!existing || now > existing.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (existing.count >= 15) {
    return false;
  }
  existing.count += 1;
  return true;
}

function validateProjectPayload(body: unknown): {
  ok: true;
  data: Omit<StoredProject, 'id' | 'createdAt'>;
} | {
  ok: false;
  error: string;
} {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Invalid request payload.' };
  }

  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const property = typeof raw.property === 'string' ? raw.property.trim() : '';
  const year = typeof raw.year === 'string' ? raw.year.trim() : String(new Date().getFullYear());
  const category = typeof raw.category === 'string' ? raw.category.trim() : '';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const imageDataUrl = typeof raw.imageDataUrl === 'string' ? raw.imageDataUrl.trim() : '';

  if (!title || title.length > 140) {
    return { ok: false, error: 'Title is required (max 140 characters).' };
  }
  if (!property || property.length > 140) {
    return { ok: false, error: 'Property name is required (max 140 characters).' };
  }
  if (year.length > 24) {
    return { ok: false, error: 'Year is too long.' };
  }
  if (!VALID_CATEGORIES.has(category as ProjectCategory)) {
    return { ok: false, error: 'Invalid project category.' };
  }
  if (description.length > 1200) {
    return { ok: false, error: 'Description is too long (max 1200 characters).' };
  }
  if (!DATA_IMAGE_RE.test(imageDataUrl) || imageDataUrl.length > 4_500_000) {
    return { ok: false, error: 'Image must be a valid JPEG, PNG, or WebP upload under 3 MB.' };
  }

  return {
    ok: true,
    data: {
      title,
      property,
      year: year || String(new Date().getFullYear()),
      category: category as ProjectCategory,
      description,
      imageDataUrl,
    },
  };
}

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use('/api/auth', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '6mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/status', (req, res) => {
  const envConfig = getEnvAdminConfig();
  const store = readStore();
  const needsSetup = !envConfig && !store.adminCredential;

  const token = extractBearerToken(req);
  const verified = token ? verifySessionToken(token) : null;

  res.json({
    needsSetup,
    configured: !needsSetup,
    authenticated: Boolean(verified),
    email: verified?.email ?? null,
  });
});

app.post('/api/auth/setup', (req, res) => {
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
    return;
  }

  const envConfig = getEnvAdminConfig();
  const store = readStore();

  if (envConfig || store.adminCredential) {
    res.status(409).json({ error: 'Admin account is already configured.' });
    return;
  }

  const raw = req.body as Record<string, unknown>;
  const email = typeof raw?.email === 'string' ? normalizeEmail(raw.email) : '';
  const password = typeof raw?.password === 'string' ? raw.password : '';

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 10 || password.length > 128) {
    res.status(400).json({ error: 'Password must be between 10 and 128 characters.' });
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);

  store.adminCredential = {
    email,
    salt,
    hash,
    updatedAt: Date.now(),
  };
  writeStore(store);

  const token = signSessionToken(email);
  res.status(201).json({ token, email });
});

app.post('/api/auth/login', (req, res) => {
  const clientIp = req.ip || 'unknown';
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
    return;
  }

  const raw = req.body as Record<string, unknown>;
  const email = typeof raw?.email === 'string' ? normalizeEmail(raw.email) : '';
  const password = typeof raw?.password === 'string' ? raw.password : '';

  if (!EMAIL_RE.test(email) || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const envConfig = getEnvAdminConfig();
  if (envConfig) {
    if (envConfig.misconfigured || !envConfig.email) {
      res.status(503).json({ error: 'Server admin email is not configured.' });
      return;
    }
    const emailMatches = safeEqualText(email, envConfig.email);
    const passMatches = safeEqualText(password, envConfig.password);
    if (!emailMatches || !passMatches) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const token = signSessionToken(email);
    res.json({ token, email });
    return;
  }

  const store = readStore();
  if (!store.adminCredential) {
    res.status(409).json({
      error: 'Admin password has not been claimed yet. Complete first-run setup first.',
      needsSetup: true,
    });
    return;
  }

  const emailMatches = safeEqualText(email, store.adminCredential.email);
  const derivedHash = hashPassword(password, store.adminCredential.salt);
  const passMatches = safeEqualHex(derivedHash, store.adminCredential.hash);

  if (!emailMatches || !passMatches) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signSessionToken(store.adminCredential.email);
  res.json({ token, email: store.adminCredential.email });
});

app.post('/api/auth/logout', (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    const verified = verifySessionToken(token);
    if (verified) {
      if (revokedTokens.size >= MAX_REVOKED_TOKENS) {
        revokedTokens.clear();
      }
      revokedTokens.add(verified.jti);
    }
  }
  res.json({ ok: true });
});

app.get('/api/projects', (_req, res) => {
  const store = readStore();
  const projects = [...store.projects].sort((a, b) => b.createdAt - a.createdAt);
  res.json({ projects });
});

app.post('/api/projects', requireAdminAuth, (req, res) => {
  const validation = validateProjectPayload(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const store = readStore();
  if (store.projects.length >= 60) {
    res.status(400).json({ error: 'Maximum limit of 60 project photos reached.' });
    return;
  }

  const created: StoredProject = {
    id: `proj_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    ...validation.data,
    createdAt: Date.now(),
  };

  store.projects.unshift(created);
  writeStore(store);

  res.status(201).json({ project: created });
});

app.put('/api/projects/:id', requireAdminAuth, (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!VALID_ID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid project ID.' });
    return;
  }

  const validation = validateProjectPayload(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const store = readStore();
  const index = store.projects.findIndex((p) => p.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const updated: StoredProject = {
    ...store.projects[index],
    ...validation.data,
  };
  store.projects[index] = updated;
  writeStore(store);

  res.json({ project: updated });
});

app.delete('/api/projects/:id', requireAdminAuth, (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!VALID_ID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid project ID.' });
    return;
  }

  const store = readStore();
  const initialLength = store.projects.length;
  store.projects = store.projects.filter((p) => p.id !== id);
  if (store.projects.length === initialLength) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  writeStore(store);
  res.json({ ok: true });
});

async function startServer(): Promise<void> {
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  void startServer();
}

export default app;
