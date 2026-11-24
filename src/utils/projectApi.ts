export type ProjectCategory = 'infrastructure' | 'pms-pos' | 'security' | 'event-av';

export interface ProjectPhotoItem {
  id: string;
  title: string;
  property: string;
  year: string;
  category: ProjectCategory;
  description: string;
  imageDataUrl: string;
  createdAt: number;
  source?: 'backend' | 'static';
}

export interface AuthStatusResponse {
  needsSetup: boolean;
  configured: boolean;
  authenticated: boolean;
  email: string | null;
}

export async function fetchAuthStatus(token: string | null): Promise<AuthStatusResponse> {
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/auth/status', { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to check authentication status.');
  }
  return (await res.json()) as AuthStatusResponse;
}

export async function setupAdminAccount(
  email: string,
  password: string
): Promise<{ token: string; email: string }> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { token?: string; email?: string; error?: string };
  if (!res.ok || !data.token || !data.email) {
    throw new Error(data.error || 'Failed to complete admin setup.');
  }
  return { token: data.token, email: data.email };
}

export async function loginAdmin(
  email: string,
  password: string
): Promise<{ token: string; email: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { token?: string; email?: string; error?: string };
  if (!res.ok || !data.token || !data.email) {
    throw new Error(data.error || 'Invalid email or password.');
  }
  return { token: data.token, email: data.email };
}

export async function logoutAdmin(token: string): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

export async function fetchBackendProjects(): Promise<ProjectPhotoItem[]> {
  const res = await fetch('/api/projects', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to load projects from server.');
  }
  const data = (await res.json()) as { projects?: ProjectPhotoItem[] };
  const items = Array.isArray(data.projects) ? data.projects : [];
  return items.map((item) => ({ ...item, source: 'backend' as const }));
}

export async function fetchStaticProjects(): Promise<ProjectPhotoItem[]> {
  try {
    const response = await fetch('/projects-gallery.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return [];
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (item): item is ProjectPhotoItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ProjectPhotoItem).id === 'string' &&
          typeof (item as ProjectPhotoItem).title === 'string' &&
          typeof (item as ProjectPhotoItem).imageDataUrl === 'string'
      )
      .map((item) => ({ ...item, source: 'static' as const }));
  } catch {
    return [];
  }
}

export async function createBackendProject(
  token: string,
  payload: Omit<ProjectPhotoItem, 'id' | 'createdAt' | 'source'>
): Promise<ProjectPhotoItem> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { project?: ProjectPhotoItem; error?: string };
  if (!res.ok || !data.project) {
    throw new Error(data.error || 'Failed to upload project photo.');
  }
  return { ...data.project, source: 'backend' };
}

export async function updateBackendProject(
  token: string,
  id: string,
  payload: Omit<ProjectPhotoItem, 'id' | 'createdAt' | 'source'>
): Promise<ProjectPhotoItem> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { project?: ProjectPhotoItem; error?: string };
  if (!res.ok || !data.project) {
    throw new Error(data.error || 'Failed to update project.');
  }
  return { ...data.project, source: 'backend' };
}

export async function deleteBackendProject(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to delete project.');
  }
}

export function compressImageFile(file: File, maxDimension = 1400, quality = 0.82): Promise<string> {
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
        const outputDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(outputDataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
