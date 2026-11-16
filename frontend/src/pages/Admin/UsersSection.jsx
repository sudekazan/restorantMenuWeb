import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Pencil, Plus, RotateCcw, UserX } from 'lucide-react';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminApi } from '../../lib/api.js';
import { iconBtn, primaryBtn, secondaryBtn } from './menu/menuUi.jsx';
import UserFormModal from './users/UserFormModal.jsx';
import ResetPasswordModal from './users/ResetPasswordModal.jsx';
import { ASSIGNABLE_ROLES, roleLabel, userErrorMessage } from './users/userUtils.js';

const roleOrder = (role) => {
  const i = ASSIGNABLE_ROLES.indexOf(role);
  return i === -1 ? 99 : i;
};
const byRoleThenName = (a, b) =>
  (a.isActive === false) - (b.isActive === false) || roleOrder(a.role) - roleOrder(b.role) || a.name.localeCompare(b.name, 'tr');

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toLocaleUpperCase('tr'))
    .join('');

/**
 * Yönetim > Kullanıcılar: personel hesaplarını listeleme, ekleme, düzenleme, şifre sıfırlama
 * ve pasife alma. Backend personeli silmez, pasife alır (geçmiş kayıtlar korunur).
 */
export default function UsersSection() {
  const { toast } = useToast();
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { user?: object }
  const [resetUser, setResetUser] = useState(null);
  const [confirmUser, setConfirmUser] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const isSelf = (u) => !!me && u?._id === me._id;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminApi.listUsers();
      setUsers([...list].sort(byRoleThenName));
      setError('');
    } catch (err) {
      setError(err.message || 'Kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceUser = (updated) => setUsers((prev) => prev.map((u) => (u._id === updated._id ? { ...u, ...updated } : u)).sort(byRoleThenName));

  const saveUser = async (payload) => {
    const editing = form?.user;
    try {
      if (editing) {
        replaceUser(await adminApi.updateUser(editing._id, payload));
        toast({ title: `${payload.name} güncellendi`, variant: 'success', duration: 2500 });
      } else {
        const created = await adminApi.createUser(payload);
        setUsers((prev) => [...prev, created].sort(byRoleThenName));
        toast({ title: `${created.name} eklendi`, description: 'Personel e-posta ve şifresiyle giriş yapabilir.', variant: 'success' });
      }
      setForm(null);
    } catch (err) {
      toast({ title: 'Kullanıcı kaydedilemedi', description: userErrorMessage(err), variant: 'error' });
    }
  };

  const resetPassword = async (password) => {
    try {
      await adminApi.updateUser(resetUser._id, { password });
      toast({ title: 'Şifre değiştirildi', description: `${resetUser.name} yeni şifreyle giriş yapmalı.`, variant: 'success' });
      setResetUser(null);
    } catch (err) {
      toast({ title: 'Şifre değiştirilemedi', description: userErrorMessage(err), variant: 'error' });
    }
  };

  const deactivate = async () => {
    if (!confirmUser) return;
    try {
      await adminApi.deleteUser(confirmUser._id);
      replaceUser({ _id: confirmUser._id, isActive: false });
      toast({ title: `${confirmUser.name} pasife alındı`, variant: 'success', duration: 2500 });
      setConfirmUser(null);
    } catch (err) {
      toast({ title: 'Kullanıcı pasife alınamadı', description: userErrorMessage(err), variant: 'error' });
    }
  };

  const reactivate = async (u) => {
    setBusyId(u._id);
    try {
      replaceUser(await adminApi.updateUser(u._id, { isActive: true }));
      toast({ title: `${u.name} yeniden etkin`, variant: 'success', duration: 2500 });
    } catch (err) {
      toast({ title: 'Kullanıcı etkinleştirilemedi', description: userErrorMessage(err), variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  /* ---------- Görünüm ---------- */
  const heading = (
    <div>
      <h1 className="text-xl font-extrabold text-ink">Kullanıcılar</h1>
      <p className="text-sm text-ink-soft">Personel hesaplarını ve rollerini yönetin.</p>
    </div>
  );

  if (loading) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="py-16 flex items-center justify-center gap-3 text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
          <span className="text-sm">Kullanıcılar yükleniyor…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-4">
        {heading}
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <p className="text-sm text-rose-800">{error}</p>
          <button type="button" onClick={load} className={secondaryBtn}>
            Tekrar Dene
          </button>
        </div>
      </section>
    );
  }

  const activeCount = users.filter((u) => u.isActive !== false).length;
  const onlyMe = users.length <= 1;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">{heading}</div>
        <button type="button" onClick={() => setForm({})} className={primaryBtn}>
          <Plus className="w-4 h-4" />
          Kullanıcı Ekle
        </button>
      </div>

      <div className="bg-card border border-line rounded-3xl shadow-sm min-w-0">
        <header className="px-4 pt-4 pb-3">
          <h2 className="text-sm font-bold text-ink">
            {users.length} kullanıcı <span className="text-ink-faint font-semibold">({activeCount} etkin)</span>
          </h2>
        </header>

        <ul className="border-t border-line divide-y divide-line">
          {users.map((u) => {
            const inactive = u.isActive === false;
            const self = isSelf(u);
            return (
              <li key={u._id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="flex items-center gap-3 flex-1 min-w-[12rem]">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-extrabold shrink-0 ${
                      inactive ? 'bg-muted text-ink-faint' : 'bg-brand-50 text-brand-700'
                    }`}
                    aria-hidden="true"
                  >
                    {initials(u.name) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${inactive ? 'text-ink-faint' : 'text-ink'}`}>
                      {u.name}
                      {self && <span className="ml-1.5 text-xs font-semibold text-ink-faint">(siz)</span>}
                    </p>
                    <p className="text-xs text-ink-soft truncate">{u.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-auto">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg mr-1 ${inactive ? 'bg-muted text-ink-faint' : 'bg-brand-50 text-brand-700'}`}>
                    {inactive ? 'Pasif' : roleLabel(u.role)}
                  </span>
                  <button type="button" onClick={() => setForm({ user: u })} title="Düzenle" aria-label={`${u.name} düzenle`} className={iconBtn}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetUser(u)}
                    disabled={self}
                    title={self ? 'Kendi şifrenizi hesap ayarlarından değiştirin' : 'Şifreyi sıfırla'}
                    aria-label={`${u.name} şifresini sıfırla`}
                    className={iconBtn}
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  {inactive ? (
                    <button
                      type="button"
                      onClick={() => reactivate(u)}
                      disabled={busyId === u._id}
                      title="Yeniden etkinleştir"
                      aria-label={`${u.name} yeniden etkinleştir`}
                      className={`${iconBtn} hover:text-emerald-600`}
                    >
                      {busyId === u._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmUser(u)}
                      disabled={self}
                      title={self ? 'Kendi hesabınızı pasife alamazsınız' : 'Pasife al'}
                      aria-label={`${u.name} pasife al`}
                      className={`${iconBtn} hover:text-rose-600`}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {onlyMe && (
          <div className="border-t border-line px-4 py-8 text-center space-y-3">
            <p className="text-sm font-semibold text-ink">Henüz başka personel yok</p>
            <p className="text-sm text-ink-soft">Garson, mutfak ve kasa personeli için hesap açın; her biri yalnızca kendi ekranını görür.</p>
            <button type="button" onClick={() => setForm({})} className={primaryBtn}>
              <Plus className="w-4 h-4" />
              İlk Personeli Ekle
            </button>
          </div>
        )}
      </div>

      <UserFormModal open={!!form} user={form?.user} isSelf={isSelf(form?.user)} onClose={() => setForm(null)} onSubmit={saveUser} />
      <ResetPasswordModal open={!!resetUser} user={resetUser} onClose={() => setResetUser(null)} onSubmit={resetPassword} />
      <ConfirmDialog
        open={!!confirmUser}
        tone="danger"
        title="Kullanıcıyı pasife al"
        description={`${confirmUser?.name || ''} artık giriş yapamayacak. Hesap silinmez; geçmiş siparişlerde adı görünmeye devam eder ve istediğiniz zaman yeniden etkinleştirebilirsiniz.`}
        confirmLabel="Pasife Al"
        onConfirm={deactivate}
        onClose={() => setConfirmUser(null)}
      />
    </section>
  );
}
