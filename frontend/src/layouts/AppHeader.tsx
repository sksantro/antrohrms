import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { formatRole, getUserDisplayName, getUserInitials } from '../utils/rbac';
import { getPageSubtitle, getPageTitle } from '../utils/pageTitles';

interface AppHeaderProps {
  onLogout: () => void;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function AppHeader({ onLogout }: AppHeaderProps) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const pageTitle = getPageTitle(pathname, user);
  const pageSubtitle = getPageSubtitle(pathname, user);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  const handleLogout = () => {
    setProfileOpen(false);
    onLogout();
  };

  return (
    <header className="app-header">
      <div className="app-header-leading">
        <div className="app-header-title-block">
          <h1 className="app-header-title">{pageTitle}</h1>
          {pageSubtitle ? <p className="app-header-subtitle">{pageSubtitle}</p> : null}
        </div>
      </div>

      <div className="app-header-actions">
        <label className="app-header-search">
          <SearchIcon />
          <input
            type="search"
            className="app-header-search-input"
            placeholder="Search employees, users, requests..."
            aria-label="Search employees, users, requests"
          />
        </label>

        <button type="button" className="app-header-icon-btn" aria-label="Notifications">
          <BellIcon />
          <span className="app-header-notify-dot" aria-hidden />
        </button>

        <div className="app-header-profile" ref={profileRef}>
          <button
            type="button"
            className={`app-header-profile-trigger${profileOpen ? ' app-header-profile-trigger--open' : ''}`}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="app-header-avatar" aria-hidden>
              {getUserInitials(user)}
            </span>
            <span className="app-header-profile-meta">
              <span className="app-header-profile-name">{getUserDisplayName(user)}</span>
              {user ? <span className="app-header-profile-role">{formatRole(user.role)}</span> : null}
            </span>
            <span className="app-header-profile-chevron" aria-hidden>
              <ChevronDownIcon />
            </span>
          </button>

          {profileOpen ? (
            <div className="app-header-profile-menu" role="menu">
              <div className="app-header-profile-menu-head">
                <span className="app-header-profile-menu-name">{getUserDisplayName(user)}</span>
                {user ? <span className="app-header-profile-menu-role">{formatRole(user.role)}</span> : null}
              </div>
              <button type="button" className="app-header-profile-menu-item" role="menuitem" onClick={handleLogout}>
                <LogoutIcon />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
