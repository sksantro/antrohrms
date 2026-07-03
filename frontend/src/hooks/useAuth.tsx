import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from '../services/api';
import type {
  ChangePasswordPayload,
  LoginCredentials,
  PermissionKey,
  RolePermissions,
  User,
  UserRole,
} from '../types';
import { getRolePermissions } from '../utils/rbac';
import { storage } from '../utils/storage';

interface AuthContextValue {
  user: User | null;
  permissions: RolePermissions | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  hasRole: (...roles: UserRole[]) => boolean;
  can: (permission: PermissionKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyUser = useCallback((nextUser: User) => {
    setUser(nextUser);
    setPermissions(getRolePermissions(nextUser.role));
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await api.getCurrentUser();
    applyUser(currentUser);
    return currentUser;
  }, [applyUser]);

  const logout = useCallback(async () => {
    try {
      if (storage.getAccessToken()) {
        await api.logout();
      }
    } catch {
      // Clear local session even if server logout fails.
    } finally {
      storage.clearTokens();
      setUser(null);
      setPermissions(null);
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await api.login(credentials);
    storage.setTokens(response.access, response.refresh);
    applyUser(response.user);
    return response.user;
  }, [applyUser]);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    await api.changePassword(payload);
    const currentUser = await api.getCurrentUser();
    applyUser(currentUser);
  }, [applyUser]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) {
        return false;
      }
      return roles.includes(user.role);
    },
    [user],
  );

  const can = useCallback(
    (permission: PermissionKey) => {
      return Boolean(permissions?.[permission]);
    },
    [permissions],
  );

  useEffect(() => {
    const initializeAuth = async () => {
      const token = storage.getAccessToken();

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await api.getCurrentUser();
        applyUser(currentUser);
      } catch {
        storage.clearTokens();
        setUser(null);
        setPermissions(null);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      permissions,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      changePassword,
      refreshUser,
      hasRole,
      can,
    }),
    [user, permissions, isLoading, login, logout, changePassword, refreshUser, hasRole, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
