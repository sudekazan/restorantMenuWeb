import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/ToastProvider.jsx';
import { ADMIN_ROLES, AuthProvider, STAFF_ROLES } from './context/AuthContext.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import HomeLanding from './pages/HomeLanding.jsx';
import Login from './pages/Login.jsx';
import CustomerApp from './pages/CustomerMenu/CustomerApp.jsx';
import StaffApp from './pages/Staff/StaffApp.jsx';
import AdminApp from './pages/Admin/AdminApp.jsx';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeLanding />} />
            {/* 1. Müşteri Ekranı (Mobile-First & PWA) */}
            <Route path="/m/:qrToken" element={<CustomerApp />} />

            {/* Personel / Yönetici ortak giriş */}
            <Route path="/login" element={<Login />} />

            {/* 2. Personel / Mutfak Kanban Ekranı */}
            <Route
              path="/staff/*"
              element={
                <ProtectedRoute roles={STAFF_ROLES}>
                  <StaffApp />
                </ProtectedRoute>
              }
            />

            {/* 3. Admin Paneli */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute roles={ADMIN_ROLES}>
                  <AdminApp />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
