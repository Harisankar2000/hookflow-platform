import { Session } from './session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let current: Session | null = null;
export const setApiSession = (session: Session | null) => {
  current = session;
};

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!current) throw new ApiError(401, 'Not signed in');
  const res = await fetch(current.apiUrl.replace(/\/$/, '') + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${current.apiKey}`,
      ...init.headers,
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(res.status, message ?? res.statusText);
  }
  return body as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

/** Creates an organization with the server's admin token. Used on the sign-in screen. */
export async function createOrganization(apiUrl: string, adminToken: string, name: string) {
  const res = await fetch(apiUrl.replace(/\/$/, '') + '/v1/organizations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-token': adminToken },
    body: JSON.stringify({ name }),
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body?.message ?? 'Could not create organization');
  return body as { apiKey: string };
}
