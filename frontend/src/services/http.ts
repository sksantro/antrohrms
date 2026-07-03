import { env } from '../config/env';
import { storage } from '../utils/storage';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = storage.getRefreshToken();
  if (!refresh) {
    return null;
  }

  const response = await fetch(`${env.apiBaseUrl}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    storage.clearTokens();
    return null;
  }

  const data = (await response.json()) as { access: string; refresh?: string };
  storage.setTokens(data.access, data.refresh ?? refresh);
  return data.access;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);

  if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = storage.getAccessToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const execute = () =>
    fetch(`${env.apiBaseUrl}${endpoint}`, {
      ...rest,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await execute();

  if (response.status === 401 && auth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set('Authorization', `Bearer ${newToken}`);
      response = await execute();
    }
  }

  if (!response.ok) {
    let message = 'Request failed';

    try {
      const errorBody = (await response.json()) as Record<string, unknown>;
      if (typeof errorBody.detail === 'string') {
        message = errorBody.detail;
      } else if (Array.isArray(errorBody.non_field_errors)) {
        message = errorBody.non_field_errors.join(' ');
      } else {
        const fieldMessages = Object.entries(errorBody)
          .map(([key, value]) => {
            if (Array.isArray(value)) return `${key}: ${value.join(' ')}`;
            if (typeof value === 'string') return `${key}: ${value}`;
            return '';
          })
          .filter(Boolean);
        if (fieldMessages.length) {
          message = fieldMessages.join(' ');
        }
      }
    } catch {
      // Use default message when response is not JSON.
    }

    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiUpload<T>(endpoint: string, formData: FormData, method = 'POST'): Promise<T> {
  const requestHeaders = new Headers();
  const token = storage.getAccessToken();
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const execute = () =>
    fetch(`${env.apiBaseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: formData,
    });

  let response = await execute();

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      requestHeaders.set('Authorization', `Bearer ${newToken}`);
      response = await execute();
    }
  }

  if (!response.ok) {
    let message = 'Upload failed';
    try {
      const errorBody = (await response.json()) as Record<string, unknown>;
      if (typeof errorBody.detail === 'string') {
        message = errorBody.detail;
      } else {
        const fieldMessages = Object.entries(errorBody)
          .map(([key, value]) => {
            if (Array.isArray(value)) return `${key}: ${value.join(' ')}`;
            if (typeof value === 'string') return `${key}: ${value}`;
            return '';
          })
          .filter(Boolean);
        if (fieldMessages.length) message = fieldMessages.join(' ');
      }
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
