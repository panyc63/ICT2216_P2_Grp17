import { dashboardForRole } from '../utils/roles.js';

export { dashboardForRole };

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

let sessionCache = null;

function getCookie(name) {
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') || '';
}

async function ensureCsrfToken() {
  const current = getCookie('mf_csrf');
  if (current) return decodeURIComponent(current);
  const response = await fetch(`${API_URL}/csrf`, { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to initialize CSRF protection.');
  const data = await response.json();
  return data.csrfToken;
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-CSRF-Token'] = await ensureCsrfToken();
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    // Validation errors use { error }, while anti-automation / rate-limit responses use
    // { status, message } — surface either so the user sees the real reason, not a generic
    // "Request failed." A 429 also carries a Retry-After hint.
    const detail = typeof data === 'object' ? (data.error || data.message) : (typeof data === 'string' ? data : '');
    let message = detail || 'Request failed.';
    if (response.status === 429 && !detail) message = 'Too many requests. Please wait a minute and try again.';
    throw new Error(message);
  }

  return data;
}

export function cacheSession(data) {
  sessionCache = data;
  if (data?.user) {
    localStorage.setItem('userRole', data.user.role);
    localStorage.setItem('userId', data.user.user_id);
    localStorage.setItem('sessionExpiresAt', data.expiresAt || '');
  }
}

export function clearSession() {
  sessionCache = null;
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
  localStorage.removeItem('sessionExpiresAt');
}

export async function getCurrentSession({ force = false } = {}) {
  if (!force && sessionCache?.expiresAt && new Date(sessionCache.expiresAt).getTime() > Date.now()) {
    return sessionCache;
  }

  try {
    const data = await apiFetch('/me');
    cacheSession(data);
    return data;
  } catch {
    clearSession();
    return null;
  }
}

export async function logout(router) {
  try {
    await apiFetch('/logout', { method: 'POST' });
  } catch {
    // Clear client state even if the server session has already expired.
  } finally {
    clearSession();
    router.push('/login');
  }
}
