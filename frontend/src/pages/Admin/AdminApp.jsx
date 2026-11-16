import React, { useEffect, useMemo, useRef } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BarChart3, ChefHat, ClipboardList, LogOut, QrCode, Settings, Users, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS } from '../../lib/format.js';
import { adminCan } from './adminRoles.js';
import MenuSection from './MenuSection.jsx';
import TablesSection from './TablesSection.jsx';
import UsersSection from './UsersSection.jsx';
import SettingsSection from './SettingsSection.jsx';
import ReportsSection from './ReportsSection.jsx';

const SECTIONS = [
  { path: 'menu', label: 'Menü', icon: UtensilsCrossed, element: <MenuSection />, allowed: (can) => can.manageMenu },
  { path: 'tables', label: 'Masalar ve QR', icon: QrCode, element: <TablesSection />, allowed: (can) => can.manageTables },
  { path: 'users', label: 'Kullanıcılar', icon: Users, element: <UsersSection />, allowed: (can) => can.manageUsers },
  { path: 'settings', label: 'Ayarlar', icon: Settings, element: <SettingsSection />, allowed: (can) => can.viewSettings },
  { path: 'reports', label: 'Raporlar', icon: BarChart3, element: <ReportsSection />, allowed: (can) => can.viewReports },
];

function navClass({ isActive }) {
  return `shrink-0 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:text-ink hover:bg-muted'
  }`;
}

export default function AdminApp() {
  const { user, restaurant, logout } = useAuth();
  const can = useMemo(() => adminCan(user?.role), [user?.role]);
  const sections = SECTIONS.filter((s) => s.allowed(can));
  const fallback = sections[0]?.path || 'menu';
  const { pathname } = useLocation();
  const mobileNavRef = useRef(null);

  // Mobilde aktif sekme şeridin dışında kalmasın (ör. /admin/reports doğrudan açıldığında)
  useEffect(() => {
    const nav = mobileNavRef.current;
    const active = nav?.querySelector('[aria-current="page"]');
    if (!nav || !active) return;
    const left = active.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    if (left < nav.scrollLeft || left + active.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: Math.max(0, left - 16) });
    }
  }, [pathname]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-app text-ink flex flex-col">
      <header className="shrink-0 z-30 bg-card border-b border-line">
        <div className="px-4 lg:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 mr-auto">
            <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink truncate">{restaurant?.name || 'Restoran'} · Yönetim</p>
              <p className="text-xs text-ink-soft truncate">
                {user?.name} · {ROLE_LABELS[user?.role] || user?.role}
              </p>
            </div>
          </div>
          <Link
            to="/staff"
            title="Personel ekranına geç"
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold text-ink-soft hover:text-ink hover:bg-muted transition"
          >
            <ClipboardList className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">Personel Ekranı</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            title="Çıkış yap"
            aria-label="Çıkış yap"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-muted transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Mobil / tablet: yatay kaydırılan sekme çubuğu */}
        <nav ref={mobileNavRef} aria-label="Yönetim bölümleri" className="lg:hidden flex gap-1 overflow-x-auto px-4 pb-2">
          {sections.map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} className={navClass}>
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* Masaüstü: sol gezinme */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-1 bg-card border-r border-line p-3 overflow-y-auto">
          <nav aria-label="Yönetim bölümleri" className="flex flex-col gap-1">
            {sections.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} className={navClass}>
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 lg:px-6 py-5">
            <Routes>
              <Route index element={<Navigate to={fallback} replace />} />
              {sections.map(({ path, element }) => (
                <Route key={path} path={path} element={element} />
              ))}
              <Route path="*" element={<Navigate to={fallback} replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
