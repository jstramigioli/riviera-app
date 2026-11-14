import { API_URL } from './api';

let installed = false;

function isApiUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith(API_URL)) return true;
  if (url.startsWith('/api')) return true;
  return url.includes('://localhost:3001/') || url.includes('://127.0.0.1:3001/');
}

/** Asegura credentials:include en llamadas a la API y dispara auth:unauthorized en 401. */
export function installApiFetchCredentials() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (!isApiUrl(url)) {
      return originalFetch(input, init);
    }

    const nextInit = {
      ...init,
      credentials: init.credentials || 'include'
    };

    const response = await originalFetch(input, nextInit);
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { url } }));
    }
    return response;
  };
}
