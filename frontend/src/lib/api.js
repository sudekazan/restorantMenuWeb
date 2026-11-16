const API_PREFIX = import.meta.env.VITE_API_URL || '/api/v1';

/** Oturum süresi dolduğunda (401) AuthContext'in dinlediği global olay adı. */
export const UNAUTHORIZED_EVENT = 'qr:unauthorized';

export function getAuthToken() {
  return localStorage.getItem('qr_staff_token') || '';
}

export function setAuthToken(token) {
  if (token) localStorage.setItem('qr_staff_token', token);
  else localStorage.removeItem('qr_staff_token');
}

/** { a: 1, b: undefined, c: [x, y] } -> "?a=1&c=x,y" (boş değerler atlanır) */
export function toQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','));
      return;
    }
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function buildHeaders({ headers = {}, auth, isForm, hasBody }) {
  const reqHeaders = { ...headers };
  if (!isForm && hasBody) reqHeaders['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAuthToken();
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
  }
  return reqHeaders;
}

function toApiError(res, json) {
  const err = new Error(json?.error?.message || `İstek başarısız oldu (${res.status})`);
  err.code = json?.error?.code || 'API_ERROR';
  err.status = res.status;
  err.details = json?.error?.details;
  return err;
}

function notifyUnauthorized(auth, status) {
  if (auth && status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export async function apiFetch(path, { method = 'GET', body, headers = {}, auth = false, isForm = false } = {}) {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers: buildHeaders({ headers, auth, isForm, hasBody: body !== undefined }),
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (res.status === 204) return null;

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    notifyUnauthorized(auth, res.status);
    throw toApiError(res, json);
  }

  return json.data;
}

/** PDF / PNG gibi ikili yanıtlar için: başarılıysa Blob döner, hata gövdesi JSON ise onu fırlatır. */
export async function apiFetchBlob(path, { auth = true } = {}) {
  const res = await fetch(`${API_PREFIX}${path}`, { headers: buildHeaders({ auth }) });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    notifyUnauthorized(auth, res.status);
    throw toApiError(res, json);
  }
  return res.blob();
}

/* ---------- MÜŞTERİ (PUBLIC QR) API ---------- */
export const publicApi = {
  getTableInfo: (qrToken) => apiFetch(`/public/t/${qrToken}`),
  getMenu: (qrToken) => apiFetch(`/public/t/${qrToken}/menu`),
  getSession: (qrToken) => apiFetch(`/public/t/${qrToken}/session`),
  placeOrder: (qrToken, payload) => apiFetch(`/public/t/${qrToken}/orders`, { method: 'POST', body: payload }),
  callWaiter: (qrToken, payload) => apiFetch(`/public/t/${qrToken}/waiter-calls`, { method: 'POST', body: payload }),
  initIyzico: (qrToken, payload) =>
    apiFetch(`/public/t/${qrToken}/payments/iyzico/initialize`, { method: 'POST', body: payload }),
  getPaymentStatus: (qrToken, paymentId) => apiFetch(`/public/t/${qrToken}/payments/${paymentId}`),
};

/* ---------- KİMLİK DOĞRULAMA API ---------- */
export const authApi = {
  login: ({ email, password }) => apiFetch('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => apiFetch('/auth/register', { method: 'POST', body: payload }),
  me: () => apiFetch('/auth/me', { auth: true }),
  changePassword: ({ currentPassword, newPassword }) =>
    apiFetch('/auth/me/password', { method: 'PATCH', body: { currentPassword, newPassword }, auth: true }),
};

/* ---------- PERSONEL / MUTFAK API ---------- */
export const staffApi = {
  // Siparişler (Kanban)
  listOrders: ({ status, date } = {}) => apiFetch(`/staff/orders${toQuery({ status, date })}`, { auth: true }),
  getOrder: (id) => apiFetch(`/staff/orders/${id}`, { auth: true }),
  createOrder: (payload) => apiFetch('/staff/orders', { method: 'POST', body: payload, auth: true }),
  updateOrderStatus: (id, { status, kanbanPosition, cancelReason }) =>
    apiFetch(`/staff/orders/${id}/status`, {
      method: 'PATCH',
      body: { status, kanbanPosition, cancelReason },
      auth: true,
    }),

  // Masa haritası & adisyon
  listTables: () => apiFetch('/staff/tables', { auth: true }),
  getTableSession: (tableId) => apiFetch(`/staff/tables/${tableId}/session`, { auth: true }),
  addPayment: (sessionId, { method, amount, tipAmount }) =>
    apiFetch(`/staff/sessions/${sessionId}/payments`, {
      method: 'POST',
      body: { method, amount, tipAmount },
      auth: true,
    }),
  closeSession: (sessionId, { force = false } = {}) =>
    apiFetch(`/staff/sessions/${sessionId}/close`, { method: 'POST', body: { force }, auth: true }),
  refundPayment: (paymentId) => apiFetch(`/staff/payments/${paymentId}/refund`, { method: 'POST', auth: true }),

  // Garson çağrıları
  listWaiterCalls: ({ status } = {}) => apiFetch(`/staff/waiter-calls${toQuery({ status })}`, { auth: true }),
  updateWaiterCall: (id, status) =>
    apiFetch(`/staff/waiter-calls/${id}`, { method: 'PATCH', body: { status }, auth: true }),

  // Mutfak: ürün tükendi / mevcut
  listProducts: ({ category, search } = {}) => apiFetch(`/staff/products${toQuery({ category, search })}`, { auth: true }),
  setProductAvailability: (id, isAvailable) =>
    apiFetch(`/staff/products/${id}/availability`, { method: 'PATCH', body: { isAvailable }, auth: true }),
};

/* ---------- YÖNETİCİ (ADMIN) API ---------- */
export const adminApi = {
  // Restoran & İyzico
  getRestaurant: () => apiFetch('/admin/restaurant', { auth: true }),
  updateRestaurant: (payload) => apiFetch('/admin/restaurant', { method: 'PATCH', body: payload, auth: true }),
  updateIyzico: (payload) => apiFetch('/admin/restaurant/iyzico', { method: 'PATCH', body: payload, auth: true }),

  // Kategoriler
  listCategories: () => apiFetch('/admin/categories', { auth: true }),
  createCategory: (payload) => apiFetch('/admin/categories', { method: 'POST', body: payload, auth: true }),
  reorderCategories: (ids) => apiFetch('/admin/categories/reorder', { method: 'PATCH', body: { ids }, auth: true }),
  updateCategory: (id, payload) => apiFetch(`/admin/categories/${id}`, { method: 'PATCH', body: payload, auth: true }),
  deleteCategory: (id) => apiFetch(`/admin/categories/${id}`, { method: 'DELETE', auth: true }),

  // Ürünler
  listProducts: ({ category, search, includeInactive } = {}) =>
    apiFetch(`/admin/products${toQuery({ category, search, includeInactive })}`, { auth: true }),
  getProduct: (id) => apiFetch(`/admin/products/${id}`, { auth: true }),
  createProduct: (payload) => apiFetch('/admin/products', { method: 'POST', body: payload, auth: true }),
  updateProduct: (id, payload) => apiFetch(`/admin/products/${id}`, { method: 'PATCH', body: payload, auth: true }),
  deleteProduct: (id) => apiFetch(`/admin/products/${id}`, { method: 'DELETE', auth: true }),
  uploadProductImage: (id, file) => {
    const form = new FormData();
    form.append('image', file);
    return apiFetch(`/admin/products/${id}/image`, { method: 'POST', body: form, isForm: true, auth: true });
  },

  // Masalar & QR
  listTables: () => apiFetch('/admin/tables', { auth: true }),
  getTable: (id) => apiFetch(`/admin/tables/${id}`, { auth: true }),
  createTable: (payload) => apiFetch('/admin/tables', { method: 'POST', body: payload, auth: true }),
  bulkCreateTables: ({ from, to, area, capacity }) =>
    apiFetch('/admin/tables/bulk', { method: 'POST', body: { from, to, area, capacity }, auth: true }),
  updateTable: (id, payload) => apiFetch(`/admin/tables/${id}`, { method: 'PATCH', body: payload, auth: true }),
  deleteTable: (id) => apiFetch(`/admin/tables/${id}`, { method: 'DELETE', auth: true }),
  rotateTableQr: (id) => apiFetch(`/admin/tables/${id}/rotate-qr`, { method: 'POST', auth: true }),
  getTableQrPng: (id) => apiFetchBlob(`/admin/tables/${id}/qr/png`),
  getTableQrPdf: (id) => apiFetchBlob(`/admin/tables/${id}/qr/pdf`),
  getBulkQrPdf: (ids = []) => apiFetchBlob(`/admin/tables/qr/pdf${toQuery({ ids })}`),

  // Personel
  listUsers: () => apiFetch('/admin/users', { auth: true }),
  createUser: (payload) => apiFetch('/admin/users', { method: 'POST', body: payload, auth: true }),
  updateUser: (id, payload) => apiFetch(`/admin/users/${id}`, { method: 'PATCH', body: payload, auth: true }),
  deleteUser: (id) => apiFetch(`/admin/users/${id}`, { method: 'DELETE', auth: true }),

  // Raporlar
  getReportSummary: ({ from, to } = {}) => apiFetch(`/admin/reports/summary${toQuery({ from, to })}`, { auth: true }),
};
