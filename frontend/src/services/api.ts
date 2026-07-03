import { apiRequest } from './http';
import { storage } from '../utils/storage';
import type {
  ChangePasswordPayload,
  ChangePasswordResponse,
  CreateUserPayload,
  HealthCheckResponse,
  LoginCredentials,
  LoginResponse,
  User,
} from '../types';

export { ApiError } from './http';

export const api = {
  healthCheck(): Promise<HealthCheckResponse> {
    return apiRequest<HealthCheckResponse>('/health/', { auth: false });
  },

  login(credentials: LoginCredentials): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/auth/login/', {
      method: 'POST',
      body: credentials,
      auth: false,
    });
  },

  logout(): Promise<{ detail: string }> {
    const refresh = storage.getRefreshToken();
    return apiRequest<{ detail: string }>('/auth/logout/', {
      method: 'POST',
      body: refresh ? { refresh } : {},
    });
  },

  getCurrentUser(): Promise<User> {
    return apiRequest<User>('/auth/me/');
  },

  changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
    return apiRequest<ChangePasswordResponse>('/auth/change-password/', {
      method: 'POST',
      body: payload,
    });
  },

  listUsers(): Promise<User[]> {
    return apiRequest<User[]>('/accounts/users/');
  },

  createUser(payload: CreateUserPayload): Promise<User> {
    return apiRequest<User>('/accounts/users/', {
      method: 'POST',
      body: payload,
    });
  },
};
