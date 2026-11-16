import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  UtensilsCrossed,
  ShoppingBag,
  CreditCard,
  BellRing,
  Wifi,
  WifiOff,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { publicApi } from '../../lib/api.js';
import { createCustomerSocket, emitWithAck } from '../../lib/socket.js';
import { formatKurus, ORDER_STATUS_META } from '../../lib/format.js';
import { useToast } from '../../components/ui/ToastProvider.jsx';
import MenuTab from './MenuTab.jsx';
import ProductModal from './ProductModal.jsx';
import CartTab from './CartTab.jsx';
import PaymentTab from './PaymentTab.jsx';
import WaiterTab from './WaiterTab.jsx';

const CART_STORAGE_PREFIX = 'qr_menu_cart:';

export default function CustomerApp() {
  const { qrToken } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [restaurant, setRestaurant] = useState(null);
  const [table, setTable] = useState(null);
  const [categories, setCategories] = useState([]);
  const [session, setSession] = useState(null);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);

  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'cart' | 'payment' | 'waiter'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [sendingCall, setSendingCall] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const socketRef = useRef(null);

  // Sepeti qrToken bazlı localStorage'da sakla
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(`${CART_STORAGE_PREFIX}${qrToken}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${CART_STORAGE_PREFIX}${qrToken}`, JSON.stringify(cart));
    } catch {
      // storage full
    }
  }, [cart, qrToken]);

  const fetchSessionDetails = useCallback(async () => {
    try {
      const data = await publicApi.getSession(qrToken);
      setSession(data.session);
      setOrders(data.orders || []);
      setPayments(data.payments || []);
      return data;
    } catch {
      return null;
    }
  }, [qrToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tableInfo, menuData, sessionData] = await Promise.all([
        publicApi.getTableInfo(qrToken),
        publicApi.getMenu(qrToken),
        publicApi.getSession(qrToken),
      ]);

      setRestaurant(tableInfo.restaurant);
      setTable(tableInfo.table);
      setCategories(menuData.categories || []);
      setSession(sessionData.session || tableInfo.session || null);
      setOrders(sessionData.orders || []);
      setPayments(sessionData.payments || []);
    } catch (err) {
      setError(err.message || 'Masa bilgisi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [qrToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // İyzico callback dönüşü (?payment=success|failed) yakala
  useEffect(() => {
    const paymentResult = searchParams.get('payment');
    if (!paymentResult) return;

    const reason = searchParams.get('reason');
    if (paymentResult === 'success') {
      toast({
        title: 'Ödemeniz Başarıyla Alındı 🎉',
        description: 'Masa adisyonunuz güncellendi. Afiyet olsun!',
        variant: 'success',
        duration: 6000,
      });
      setActiveTab('payment');
      fetchSessionDetails();
    } else if (paymentResult === 'failed') {
      toast({
        title: 'Ödeme Tamamlanamadı',
        description: reason || 'Kart işlemi onaylanmadı, lütfen tekrar deneyin.',
        variant: 'error',
        duration: 6000,
      });
      setActiveTab('payment');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('payment');
    next.delete('paymentId');
    next.delete('reason');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, toast, fetchSessionDetails]);

  // Socket.IO gerçek zamanlı bağlantı ve olay dinleyicileri
  useEffect(() => {
    if (!qrToken || !table) return;

    const socket = createCustomerSocket({
      qrToken,
      sessionKey: session?.sessionKey,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('table:join', { qrToken, sessionKey: session?.sessionKey });
    });

    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('order:new', (newOrder) => {
      setOrders((prev) => {
        if (prev.some((o) => o._id === newOrder._id)) return prev;
        return [...prev, newOrder];
      });
    });

    socket.on('order:updated', (updated) => {
      setOrders((prev) =>
        prev.map((o) => (o._id === updated._id ? { ...o, status: updated.status } : o))
      );
      const statusMeta = ORDER_STATUS_META[updated.status];
      if (statusMeta) {
        toast({
          title: `Sipariş #${updated.orderNumber}: ${statusMeta.label}`,
          description: 'Siparişinizin mutfak durumu güncellendi.',
          variant: updated.status === 'delivered' ? 'success' : 'info',
        });
      }
    });

    socket.on('session:updated', (payload) => {
      if (payload.status === 'closed' || payload.status === 'cancelled') {
        setSession(null);
        setOrders([]);
        setPayments([]);
        toast({
          title: 'Masa Hesabı Kapatıldı',
          description: 'Bizi tercih ettiğiniz için teşekkür ederiz!',
          variant: 'success',
        });
        return;
      }
      setSession((prev) =>
        prev
          ? {
              ...prev,
              status: payload.status ?? prev.status,
              totalAmount: payload.totalAmount ?? prev.totalAmount,
              paidAmount: payload.paidAmount ?? prev.paidAmount,
              remainingAmount: payload.remainingAmount ?? prev.remainingAmount,
            }
          : prev
      );
    });

    socket.on('payment:received', (payload) => {
      fetchSessionDetails();
      toast({
        title: 'Ödeme Kaydedildi',
        description: `${formatKurus(payload.amount, restaurant?.currency)} tutarında ödeme alındı.`,
        variant: 'success',
      });
    });

    socket.on('payment:refunded', () => {
      fetchSessionDetails();
      toast({
        title: 'Ödeme İadesi Yapıldı',
        description: 'Masa adisyon bakiyeniz güncellendi.',
        variant: 'info',
      });
    });

    socket.on('waiter-call:new', (call) => {
      setActiveCall(call);
    });

    socket.on('waiter-call:updated', (call) => {
      setActiveCall((prev) => (prev ? { ...prev, ...call } : call));
      if (call.status === 'acknowledged') {
        toast({
          title: 'Garsonunuz Geliyor! 👋',
          description: 'Çağrınız personelimiz tarafından onaylandı.',
          variant: 'success',
        });
      }
    });

    socket.on('product:availability', ({ productId, isAvailable }) => {
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          products: (cat.products || []).map((p) =>
            p._id === productId ? { ...p, isAvailable } : p
          ),
        }))
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [qrToken, table?._id, session?.sessionKey, restaurant?.currency, toast, fetchSessionDetails]);

  /* ---------- SEPET İŞLEMLERİ ---------- */
  const handleAddToCart = useCallback(
    ({ product, quantity, unitPrice, selectedOptions = [], optionSummary = [], note = '' }) => {
      const signature = JSON.stringify({
        productId: product._id,
        options: selectedOptions,
        note,
      });

      setCart((prev) => {
        const existingIdx = prev.findIndex((i) => i.signature === signature);
        if (existingIdx > -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + quantity,
          };
          return updated;
        }
        return [
          ...prev,
          {
            cartItemId: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            signature,
            product: { _id: product._id, name: product.name, imageUrl: product.imageUrl },
            quantity,
            unitPrice,
            selectedOptions,
            optionSummary,
            note,
          },
        ];
      });

      toast({
        title: `${product.name} sepete eklendi`,
        description: `${quantity} adet • ${formatKurus(unitPrice * quantity, restaurant?.currency)}`,
        variant: 'success',
        duration: 2200,
      });
    },
    [restaurant?.currency, toast]
  );

  const handleQuickAdd = useCallback(
    (product) => {
      handleAddToCart({
        product,
        quantity: 1,
        unitPrice: product.price,
        selectedOptions: [],
        optionSummary: [],
        note: '',
      });
    },
    [handleAddToCart]
  );

  const handleUpdateQuantity = (cartItemId, nextQty) => {
    setCart((prev) =>
      prev.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity: nextQty } : item))
    );
  };

  const handleRemoveItem = (cartItemId) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const handleClearCart = () => setCart([]);

  /* ---------- SİPARİŞ GÖNDERME ---------- */
  const handleSubmitOrder = async (customerNote) => {
    setSubmittingOrder(true);
    try {
      const payload = {
        items: cart.map((i) => ({
          product: i.product._id,
          quantity: i.quantity,
          selectedOptions: i.selectedOptions,
          ...(i.note && { note: i.note }),
        })),
        ...(customerNote && { customerNote }),
      };

      const res = await publicApi.placeOrder(qrToken, payload);
      setCart([]);
      setSession(res.session);
      setOrders((prev) => {
        if (prev.some((o) => o._id === res.order._id)) return prev;
        return [...prev, res.order];
      });

      // Yeni oluşan sessionKey odasına katıl
      if (res.session?.sessionKey && socketRef.current?.connected) {
        socketRef.current.emit('session:join', { sessionKey: res.session.sessionKey });
      }

      toast({
        title: `Siparişiniz Mutfağa İletildi (#${res.order.orderNumber})`,
        description: 'Siparişinizin hazırlanma durumunu bu ekrandan canlı takip edebilirsiniz.',
        variant: 'success',
      });
      return true;
    } catch (err) {
      toast({
        title: 'Sipariş Gönderilemedi',
        description: err.message,
        variant: 'error',
      });
      return false;
    } finally {
      setSubmittingOrder(false);
    }
  };

  /* ---------- TEK TUŞLA GARSON ÇAĞIRMA (SOCKET.IO + REST FALLBACK) ---------- */
  const handleTriggerWaiterCall = async ({ type = 'call_waiter', note }) => {
    setSendingCall(true);
    try {
      let res;
      if (socketRef.current?.connected) {
        res = await emitWithAck(socketRef.current, 'waiter:call', { qrToken, type, note });
      } else {
        res = await publicApi.callWaiter(qrToken, { type, note });
      }

      setActiveCall(res.call);
      toast({
        title: res.duplicate ? 'Çağrınız Zaten İletildi' : 'Personel Bilgilendirildi 🔔',
        description: res.duplicate
          ? 'Garsonumuz birazdan masanızda olacak.'
          : 'Masanızdan yapılan çağrı personel ekranına düştü.',
        variant: 'success',
      });
      return true;
    } catch (err) {
      toast({
        title: 'Çağrı Gönderilemedi',
        description: err.message,
        variant: 'error',
      });
      return false;
    } finally {
      setSendingCall(false);
    }
  };

  /* ---------- ONLINE ÖDEME (İYZİCO) BAŞLATMA ---------- */
  const handleInitOnlinePayment = async ({ amount, tipAmount }) => {
    try {
      return await publicApi.initIyzico(qrToken, { amount, tipAmount });
    } catch (err) {
      toast({
        title: 'Ödeme Başlatılamadı',
        description: err.message,
        variant: 'error',
      });
      return null;
    }
  };

  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cart]);
  const activeOrdersCount = useMemo(
    () => orders.filter((o) => ['new', 'preparing', 'ready'].includes(o.status)).length,
    [orders]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-app">
        <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center animate-bounce shadow-lg shadow-brand-600/30">
          <UtensilsCrossed className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-ink-soft mt-4">Dijital Menü Yükleniyor...</p>
      </div>
    );
  }

  if (error || !restaurant || !table) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-app text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <QrCode className="w-8 h-8" />
        </div>
        <h1 className="text-lg font-extrabold text-ink">Masa QR Kodu Geçersiz</h1>
        <p className="text-xs text-ink-faint max-w-xs mt-1">{error}</p>
        <button
          type="button"
          onClick={loadAll}
          className="mt-5 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-5 py-3 rounded-2xl"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Tekrar Dene</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app max-w-md mx-auto relative shadow-xl shadow-ink/5">
      {/* ÜST SABİT BAR (Restoran & Masa Bilgisi + Tek Tuş Garson Kısayolu) */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-line/70 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-orange-600 text-white font-extrabold flex items-center justify-center shadow-sm shrink-0">
            {restaurant.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-extrabold text-ink truncate">{restaurant.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center text-[11px] font-bold bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded-full border border-brand-200/60">
                {table.name || `Masa ${table.number}`} • {table.area}
              </span>
              <span
                title={socketConnected ? 'Canlı bağlantı aktif' : 'Yeniden bağlanıyor'}
                className="inline-flex items-center text-[10px] text-ink-faint"
              >
                {socketConnected ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                )}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={sendingCall}
          onClick={() => handleTriggerWaiterCall({ type: 'call_waiter' })}
          className="shrink-0 inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-200/80 text-xs font-extrabold px-3.5 py-2.5 rounded-2xl transition"
        >
          <BellRing className="w-4 h-4 text-amber-600" />
          <span>Garson</span>
        </button>
      </header>

      {/* AKTİF SEKME İÇERİĞİ */}
      <main>
        {activeTab === 'menu' && (
          <MenuTab
            categories={categories}
            currency={restaurant.currency}
            cartCount={cartCount}
            cartTotal={cartTotal}
            onSelectProduct={setSelectedProduct}
            onQuickAdd={handleQuickAdd}
            onOpenCart={() => setActiveTab('cart')}
          />
        )}

        {activeTab === 'cart' && (
          <CartTab
            cart={cart}
            orders={orders}
            currency={restaurant.currency}
            serviceChargePercent={restaurant.settings?.serviceChargePercent || 0}
            submittingOrder={submittingOrder}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveItem}
            onClearCart={handleClearCart}
            onSubmitOrder={handleSubmitOrder}
            onGoMenu={() => setActiveTab('menu')}
          />
        )}

        {activeTab === 'payment' && (
          <PaymentTab
            session={session}
            orders={orders}
            payments={payments}
            currency={restaurant.currency}
            allowOnlinePayment={restaurant.settings?.allowOnlinePayment}
            allowCashPayment={restaurant.settings?.allowCashPayment}
            onInitOnlinePayment={handleInitOnlinePayment}
            onRequestCashOrBill={(type) => handleTriggerWaiterCall({ type })}
          />
        )}

        {activeTab === 'waiter' && (
          <WaiterTab
            activeCall={activeCall}
            sendingCall={sendingCall}
            onTriggerCall={handleTriggerWaiterCall}
          />
        )}
      </main>

      {/* ÜRÜN DETAY & SEÇENEK MODALI */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          currency={restaurant.currency}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* YUVARLAK HATLI ALT NAVİGASYON BARI (Menü, Sepetim, Ödeme, Garson) */}
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-40 px-3 pb-3 pt-1 pointer-events-none">
        <div className="pointer-events-auto bg-card/95 backdrop-blur-xl border border-line/90 rounded-3xl shadow-2xl shadow-ink/10 px-2 py-1.5 grid grid-cols-4 gap-1">
          {[
            {
              id: 'menu',
              label: 'Menü',
              icon: UtensilsCrossed,
              badge: null,
            },
            {
              id: 'cart',
              label: 'Sepetim',
              icon: ShoppingBag,
              badge: cartCount > 0 ? cartCount : activeOrdersCount > 0 ? activeOrdersCount : null,
              badgeColor: cartCount > 0 ? 'bg-brand-600' : 'bg-blue-600',
            },
            {
              id: 'payment',
              label: 'Ödeme',
              icon: CreditCard,
              badge: session?.remainingAmount > 0 ? '•' : null,
              badgeColor: 'bg-emerald-600',
            },
            {
              id: 'waiter',
              label: 'Garson',
              icon: BellRing,
              badge:
                activeCall && activeCall.status !== 'resolved' ? '!' : null,
              badgeColor: 'bg-amber-500',
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-2 rounded-2xl transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-600 font-extrabold'
                    : 'text-ink-faint hover:text-ink font-semibold'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
                  {tab.badge && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold text-white flex items-center justify-center ${
                        tab.badgeColor || 'bg-brand-600'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] mt-1 leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
