import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ChefHat, LayoutGrid, LogOut, PackageCheck, Volume2, VolumeX, Wifi, WifiOff, ClipboardList } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import { authApi, staffApi } from '../../lib/api.js';
import { createStaffSocket, emitWithAck } from '../../lib/socket.js';
import { CALL_TYPE_LABELS, PAYMENT_METHOD_LABELS, ROLE_LABELS, formatKurus, tableLabel } from '../../lib/format.js';
import { useNotificationSound } from '../../hooks/useNotificationSound.js';
import { StaffContext } from './StaffContext.js';
import KanbanBoard from './KanbanBoard.jsx';
import WaiterCallsBar from './WaiterCallsBar.jsx';
import TableMap from './TableMap.jsx';
import ProductAvailability from './ProductAvailability.jsx';

const HIGHLIGHT_MS = 12000;
const ACTIVE_ORDER_STATUSES = ['new', 'preparing', 'ready'];

function roleCan(role) {
  return {
    takePayment: ['admin', 'manager', 'cashier', 'waiter'].includes(role),
    refund: ['admin', 'manager', 'cashier'].includes(role),
    manageProducts: ['admin', 'manager', 'kitchen'].includes(role),
  };
}

function idOf(ref) {
  return typeof ref === 'object' && ref !== null ? String(ref._id) : String(ref ?? '');
}

export default function StaffApp() {
  const { user, restaurant, token, logout } = useAuth();
  const { toast } = useToast();
  const sound = useNotificationSound();
  const currency = restaurant?.currency || 'TRY';
  const can = useMemo(() => roleCan(user?.role), [user?.role]);

  const [orders, setOrders] = useState([]);
  const [calls, setCalls] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState(null);
  const [highlighted, setHighlighted] = useState(() => new Set());
  // Masa adisyon çekmecesinin canlı yenilenmesi için: { [tableId]: sayaç }
  const [tableVersions, setTableVersions] = useState({});

  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const socketRef = useRef(null);
  const tablesTimerRef = useRef(null);
  // Olay işleyicileri socket'i yeniden kurmadan güncel fonksiyonlara erişsin
  const liveRef = useRef({});
  liveRef.current = { toast, play: sound.play, role: user?.role, currency };

  /* ---------------- Veri yükleme ---------------- */

  const loadOrders = useCallback(async () => setOrders(await staffApi.listOrders()), []);
  const loadCalls = useCallback(async () => setCalls(await staffApi.listWaiterCalls()), []);
  const loadTables = useCallback(async () => setTables(await staffApi.listTables()), []);

  const loadAll = useCallback(async () => {
    setLoadError('');
    try {
      await Promise.all([loadOrders(), loadCalls(), loadTables()]);
    } catch (err) {
      setLoadError(err.message || 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [loadOrders, loadCalls, loadTables]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /** Peş peşe gelen masa/oturum/ödeme olaylarını tek bir istekte toplar. */
  const scheduleTablesRefresh = useCallback(() => {
    clearTimeout(tablesTimerRef.current);
    tablesTimerRef.current = setTimeout(() => {
      loadTables().catch(() => {});
    }, 350);
  }, [loadTables]);

  useEffect(() => () => clearTimeout(tablesTimerRef.current), []);

  const bumpTable = useCallback((tableId) => {
    if (!tableId) return;
    const key = String(tableId);
    setTableVersions((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  }, []);

  const flash = useCallback((id) => {
    const key = String(id);
    setHighlighted((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, HIGHLIGHT_MS);
  }, []);

  /* ---------------- Socket.IO ---------------- */

  useEffect(() => {
    if (!token) return undefined;
    const s = createStaffSocket(token);
    socketRef.current = s;
    setSocket(s);
    let hasConnected = false;
    let retryTimer = null;

    s.on('connect', () => {
      setConnected(true);
      // Kopukluk sırasında kaçan olayları telafi et
      if (hasConnected) loadAll();
      hasConnected = true;
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => {
      setConnected(false);
      // Sunucu bağlantıyı middleware'de reddettiyse socket kendi kendine yeniden denemez
      if (!s.active) {
        authApi
          .me()
          .then(() => {
            retryTimer = setTimeout(() => s.connect(), 5000);
          })
          .catch(() => {}); // 401 ise AuthContext oturumu kapatır
      }
    });

    s.on('order:new', (order) => {
      setOrders((prev) => (prev.some((o) => o._id === order._id) ? prev : [...prev, order]));
      flash(order._id);
      bumpTable(order.table?._id);
      const { toast: notify, play } = liveRef.current;
      const itemCount = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
      notify({
        title: `Yeni Sipariş #${order.orderNumber}`,
        description: `${tableLabel(order.table)} · ${itemCount} ürün${order.source === 'waiter' ? ' · Garson girişi' : ''}`,
        variant: 'warning',
        duration: 6000,
      });
      play('order');
    });

    s.on('order:updated', (payload) => {
      const exists = ordersRef.current.some((o) => o._id === payload._id);
      if (exists) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === payload._id ? { ...o, status: payload.status, kanbanPosition: payload.kanbanPosition } : o
          )
        );
      } else if (payload.status !== 'cancelled') {
        staffApi
          .getOrder(payload._id)
          .then((order) => setOrders((prev) => (prev.some((o) => o._id === order._id) ? prev : [...prev, order])))
          .catch(() => {});
      }
      bumpTable(idOf(payload.table));
      if (payload.status === 'ready' && liveRef.current.role === 'waiter') {
        const order = ordersRef.current.find((o) => o._id === payload._id);
        liveRef.current.toast({
          title: `Sipariş #${payload.orderNumber} servise hazır`,
          description: order ? tableLabel(order.table) : undefined,
          variant: 'success',
        });
      }
    });

    s.on('waiter-call:new', (call) => {
      setCalls((prev) => (prev.some((c) => c._id === call._id) ? prev : [...prev, call]));
      flash(call._id);
      scheduleTablesRefresh();
      const { toast: notify, play } = liveRef.current;
      notify({
        title: `${tableLabel(call.table)}: ${CALL_TYPE_LABELS[call.type] || 'Çağrı'}`,
        description: call.note || 'Müşteri masadan bildirim gönderdi.',
        variant: 'warning',
        duration: 8000,
      });
      play('call');
    });

    s.on('waiter-call:updated', (payload) => {
      setCalls((prev) =>
        payload.status === 'resolved'
          ? prev.filter((c) => c._id !== payload._id)
          : prev.map((c) => (c._id === payload._id ? { ...c, status: payload.status } : c))
      );
      scheduleTablesRefresh();
    });

    const onTableChange = (payload) => {
      scheduleTablesRefresh();
      bumpTable(payload?.tableId);
    };
    s.on('table:updated', onTableChange);
    s.on('session:updated', onTableChange);
    s.on('payment:refunded', onTableChange);
    s.on('payment:received', (payload) => {
      onTableChange(payload);
      if (payload.method === 'online_card') {
        const { toast: notify, play, currency: cur } = liveRef.current;
        notify({
          title: `${payload.table ? tableLabel(payload.table) : 'Masa'}: ${PAYMENT_METHOD_LABELS.online_card} ödemesi`,
          description: `${formatKurus(payload.amount, cur)}${payload.tipAmount ? ` + ${formatKurus(payload.tipAmount, cur)} bahşiş` : ''}`,
          variant: 'success',
          duration: 6000,
        });
        play('payment');
      }
    });

    return () => {
      clearTimeout(retryTimer);
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [token, loadAll, flash, bumpTable, scheduleTablesRefresh]);

  /* ---------------- Aksiyonlar ---------------- */

  /** Sipariş durum / sıra güncellemesi: iyimser (optimistic) güncelle, hata olursa geri al. */
  const updateOrder = useCallback(
    async (orderId, patch) => {
      const before = ordersRef.current.find((o) => o._id === orderId);
      if (!before) return false;
      const previous = { status: before.status, kanbanPosition: before.kanbanPosition };
      setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, ...patch } : o)));
      try {
        const s = socketRef.current;
        if (s?.connected) await emitWithAck(s, 'order:status', { orderId, ...patch });
        else await staffApi.updateOrderStatus(orderId, patch);
        return true;
      } catch (err) {
        setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, ...previous } : o)));
        toast({ title: 'Sipariş güncellenemedi', description: err.message, variant: 'error' });
        return false;
      }
    },
    [toast]
  );

  const respondCall = useCallback(
    async (callId, status) => {
      try {
        const s = socketRef.current;
        if (s?.connected) await emitWithAck(s, 'waiter:respond', { callId, status });
        else await staffApi.updateWaiterCall(callId, status);
        setCalls((prev) =>
          status === 'resolved' ? prev.filter((c) => c._id !== callId) : prev.map((c) => (c._id === callId ? { ...c, status } : c))
        );
        scheduleTablesRefresh();
      } catch (err) {
        toast({ title: 'Çağrı güncellenemedi', description: err.message, variant: 'error' });
        loadCalls().catch(() => {});
      }
    },
    [toast, loadCalls, scheduleTablesRefresh]
  );

  /* ---------------- Görünüm ---------------- */

  const activeOrderCount = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length;
  const awaitingPaymentCount = tables.filter((t) => t.status === 'awaiting_payment').length;

  const contextValue = useMemo(
    () => ({
      user,
      restaurant,
      currency,
      can,
      socket,
      orders,
      calls,
      tables,
      loading,
      highlighted,
      tableVersions,
      updateOrder,
      respondCall,
      reloadTables: loadTables,
      reloadAll: loadAll,
    }),
    [user, restaurant, currency, can, socket, orders, calls, tables, loading, highlighted, tableVersions, updateOrder, respondCall, loadTables, loadAll]
  );

  const tabs = [
    { to: 'orders', label: 'Siparişler', icon: ClipboardList, badge: activeOrderCount },
    { to: 'tables', label: 'Masalar', icon: LayoutGrid, badge: awaitingPaymentCount, badgeTone: 'rose' },
    ...(can.manageProducts ? [{ to: 'products', label: 'Ürünler', icon: PackageCheck }] : []),
  ];

  return (
    <StaffContext.Provider value={contextValue}>
      <div className="h-[100dvh] overflow-hidden bg-app text-ink flex flex-col">
        <header className="shrink-0 z-30 bg-card border-b border-line">
          <div className="px-4 lg:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-3 min-w-0 mr-auto">
              <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink truncate">{restaurant?.name || 'Restoran'}</p>
                <p className="text-xs text-ink-soft truncate">
                  {user?.name} · {ROLE_LABELS[user?.role] || user?.role}
                </p>
              </div>
            </div>

            <nav className="order-last w-full sm:order-none sm:w-auto flex gap-1 bg-muted border border-line rounded-2xl p-1">
              {tabs.map(({ to, label, icon: Icon, badge, badgeTone }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                      isActive ? 'bg-card text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
                    }`
                  }
                >
                  <Icon className="hidden sm:block w-4 h-4" aria-hidden="true" />
                  <span>{label}</span>
                  {badge > 0 && (
                    <span
                      className={`min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center ${
                        badgeTone === 'rose' ? 'bg-rose-500 text-white' : 'bg-brand-500 text-white'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-1.5">
              <span
                title={connected ? 'Canlı bağlantı açık' : 'Canlı bağlantı yok, yeniden bağlanılıyor'}
                className={`hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border ${
                  connected
                    ? 'text-emerald-700 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-amber-700 border-amber-500/30 bg-amber-500/10'
                }`}
              >
                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {connected ? 'Canlı' : 'Bağlantı yok'}
              </span>
              <button
                type="button"
                onClick={sound.toggle}
                title={sound.enabled ? 'Bildirim sesini kapat' : 'Bildirim sesini aç'}
                aria-label={sound.enabled ? 'Bildirim sesini kapat' : 'Bildirim sesini aç'}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-soft hover:text-ink hover:bg-muted transition"
              >
                {sound.enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-ink-faint" />}
              </button>
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
          </div>

          {!connected && !loading && (
            <div className="md:hidden px-4 pb-2 text-xs text-amber-700 flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5" /> Canlı bağlantı yok, yeniden bağlanılıyor…
            </div>
          )}
        </header>

        <WaiterCallsBar />

        <main className="flex-1 min-h-0 flex flex-col">
          {loadError ? (
            <div className="m-6 p-6 rounded-3xl bg-rose-950/40 border border-rose-800/60 text-center space-y-3">
              <p className="text-sm text-rose-200">{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadAll();
                }}
                className="px-4 py-2.5 rounded-2xl text-sm font-semibold bg-muted hover:bg-line transition"
              >
                Tekrar Dene
              </button>
            </div>
          ) : (
            <Routes>
              <Route index element={<Navigate to="orders" replace />} />
              <Route path="orders" element={<KanbanBoard />} />
              <Route path="tables" element={<TableMap />} />
              {can.manageProducts && <Route path="products" element={<ProductAvailability />} />}
              <Route path="*" element={<Navigate to="orders" replace />} />
            </Routes>
          )}
        </main>
      </div>
    </StaffContext.Provider>
  );
}
