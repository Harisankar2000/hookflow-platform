import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  ChevronsUpDown,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListChecks,
  LogOut,
  Mail,
  Settings,
  Tag,
  Webhook,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api';
import { Organization } from '../types';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/applications', label: 'Applications', icon: Boxes },
  { to: '/endpoints', label: 'Endpoints', icon: Link2 },
  { to: '/messages', label: 'Messages', icon: Mail },
  { to: '/deliveries', label: 'Delivery logs', icon: ListChecks },
  { to: '/event-types', label: 'Event types', icon: Tag },
];

const settings = [
  { to: '/settings/organization', label: 'Organization', icon: Settings },
  { to: '/settings/api-keys', label: 'API keys', icon: KeyRound },
];

export function Layout({ live, onSignOut }: { live: boolean; onSignOut: () => void }) {
  const org = useQuery({ queryKey: ['organization'], queryFn: () => api<Organization>('/v1/organization') });

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <span className="brand-mark">
            <Webhook size={16} color="#fff" />
          </span>
          HookFlow
        </div>
        <div className="org-chip">
          <span className="truncate">{org.data?.name ?? '…'}</span>
          <ChevronsUpDown size={14} className="muted" />
        </div>
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-link">
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <div className="nav-section">Settings</div>
        {settings.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="nav-link">
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          <span title={live ? 'Receiving live updates' : 'Live updates disconnected'}>
            <span className={`live-dot ${live ? 'on' : ''}`} />
            {live ? 'Live' : 'Offline'}
          </span>
          <button className="btn ghost sm" onClick={onSignOut} title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
