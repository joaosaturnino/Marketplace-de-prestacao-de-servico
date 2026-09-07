const fallbackHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const fallbackProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const API_URL = import.meta.env.VITE_API_URL || `${fallbackProtocol}//${fallbackHost}:3333/api`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const data = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:expired'));
    }
    const message = typeof data === 'object' ? data?.message : data;
    throw new ApiError(message || 'Erro na requisicao.', response.status);
  }

  return data;
}
