import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';

interface PublicFirebaseMeta {
  projectId: string;
  firestoreDatabaseId: string;
}

function readPublicFirebaseMeta(): PublicFirebaseMeta {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<PublicFirebaseMeta>;
      return {
        projectId: typeof parsed.projectId === 'string' ? parsed.projectId : '',
        firestoreDatabaseId:
          typeof parsed.firestoreDatabaseId === 'string' ? parsed.firestoreDatabaseId : '',
      };
    }
  } catch {
    // Ignore missing config file
  }
  return { projectId: '', firestoreDatabaseId: '' };
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

app.get('/api/health', (_req, res) => {
  const meta = readPublicFirebaseMeta();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    backend: 'firebase-firestore',
    projectId: meta.projectId,
    databaseId: meta.firestoreDatabaseId,
    timestamp: new Date().toISOString(),
  });
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
