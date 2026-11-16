import crypto from 'crypto';
import { env } from './env.js';
import { AppError } from '../utils/AppError.js';
import { decryptSecret } from '../utils/crypto.js';

export const IYZICO_ENDPOINTS = Object.freeze({
  CHECKOUT_INITIALIZE: '/payment/iyzipos/checkoutform/initialize/auth/ecom',
  CHECKOUT_RETRIEVE: '/payment/iyzipos/checkoutform/auth/ecom/detail',
  REFUND: '/payment/refund',
});

/** Kuruş (int) -> İyzico TL string ("149.90") */
export function kurusToTl(kurus) {
  return (Number(kurus) / 100).toFixed(2);
}

/** İyzico TL string/number ("149.90") -> Kuruş (int: 14990) */
export function tlToKurus(tl) {
  return Math.round(Number(tl) * 100);
}

/**
 * İyzico IYZWSv2 HMAC-SHA256 Authorization başlığını üretir.
 * Spec: Base64("apiKey:" + apiKey + "&randomKey:" + rnd + "&signature:" + HMAC_SHA256(rnd + uriPath + body, secretKey))
 */
export function buildIyzicoAuthHeaders({ apiKey, secretKey, uriPath, bodyString }) {
  const randomKey = `${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(randomKey + uriPath + bodyString, 'utf8')
    .digest('hex');

  const authString = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return {
    Authorization: `IYZWSv2 ${Buffer.from(authString, 'utf8').toString('base64')}`,
    'x-iyzi-rnd': randomKey,
    'x-iyzi-client-version': 'iyzipay-node-2.0.64',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Restoranın kendi İyzico anahtarlarını çözer; tanımlı değilse platform varsayılanına düşer.
 * Geliştirme ortamında anahtar girilmemişse ve IYZICO_MODE=auto ise 'mock' moduna geçer.
 */
export function resolveIyzicoConfig(restaurant) {
  const tenantApiKey = decryptSecret(restaurant?.iyzico?.apiKey);
  const tenantSecretKey = decryptSecret(restaurant?.iyzico?.secretKey);
  const subMerchantKey = decryptSecret(restaurant?.iyzico?.subMerchantKey);

  const apiKey = tenantApiKey || env.iyzico.apiKey;
  const secretKey = tenantSecretKey || env.iyzico.secretKey;
  const hasCredentials = Boolean(apiKey && secretKey);

  let mode = env.iyzico.mode;
  if (mode === 'auto') {
    mode = hasCredentials ? 'live' : env.isProd ? 'live' : 'mock';
  }

  if (mode === 'live' && !hasCredentials) {
    throw AppError.badRequest(
      'Bu restoranda online ödeme (İyzico) API anahtarları henüz tanımlanmamış.',
      'IYZICO_NOT_CONFIGURED'
    );
  }

  return {
    mode,
    baseUrl: env.iyzico.baseUrl,
    apiKey,
    secretKey,
    subMerchantKey: subMerchantKey || undefined,
  };
}

/** İyzico REST API'ye imzalı POST isteği gönderir. */
async function iyzicoRequest({ config, uriPath, payload }) {
  const bodyString = JSON.stringify(payload);
  const headers = buildIyzicoAuthHeaders({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    uriPath,
    bodyString,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${config.baseUrl}${uriPath}`, {
      method: 'POST',
      headers,
      body: bodyString,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!data) {
      throw new AppError('Ödeme sağlayıcısından geçersiz yanıt alındı.', 502, 'IYZICO_BAD_GATEWAY');
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Ödeme sağlayıcısına şu anda ulaşılamıyor.', 502, 'IYZICO_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Geliştirme (mock) modunda İyzico Checkout Form davranışını birebir taklit eden HTML form.
 * Gerçek İyzico gibi callbackUrl'e POST { token } gönderir.
 */
function buildMockCheckoutFormHtml({ callbackUrl, token, price, restaurantName, tableLabel }) {
  return `
<div id="iyzico-mock-checkout" style="font-family:system-ui,-apple-system,sans-serif;border:1px solid #e5e7eb;border-radius:16px;padding:20px;max-width:420px;margin:0 auto;background:#fff;box-shadow:0 10px 25px rgba(0,0,0,0.06);">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="font-weight:700;font-size:15px;color:#111827;">iyzico Korumalı Ödeme (Test Modu)</span>
    <span style="background:#eef2ff;color:#4f46e5;font-size:12px;font-weight:600;padding:4px 8px;border-radius:999px;">SANDBOX</span>
  </div>
  <div style="font-size:13px;color:#4b5563;margin-bottom:16px;">
    <strong>${restaurantName}</strong> • ${tableLabel} — Ödenecek Tutar: <strong style="color:#111827;">${price} ₺</strong>
  </div>
  <form method="POST" action="${callbackUrl}" style="display:flex;flex-direction:column;gap:10px;">
    <input type="hidden" name="token" value="${token}" />
    <input type="hidden" name="mockStatus" value="success" id="iyzico-mock-status" />
    <button type="submit" style="background:#10b981;color:#fff;border:none;border-radius:12px;padding:12px;font-weight:600;cursor:pointer;font-size:14px;">
      Test Kartı ile Ödemeyi Onayla (${price} ₺)
    </button>
    <button type="submit" onclick="document.getElementById('iyzico-mock-status').value='failure'" style="background:#f3f4f6;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px;font-weight:500;cursor:pointer;font-size:13px;">
      Başarısız Ödeme Simüle Et
    </button>
  </form>
</div>`.trim();
}

/**
 * 1) İyzico Checkout Form Başlatma (Initialize)
 */
export async function initializeCheckoutForm({ restaurant, requestPayload, meta }) {
  const config = resolveIyzicoConfig(restaurant);

  if (config.mode === 'mock') {
    const token = `mock_${crypto.randomBytes(16).toString('hex')}`;
    const checkoutFormContent = buildMockCheckoutFormHtml({
      callbackUrl: requestPayload.callbackUrl,
      token,
      price: requestPayload.paidPrice,
      restaurantName: meta?.restaurantName || 'Restoran',
      tableLabel: meta?.tableLabel || 'Masa',
    });
    return {
      status: 'success',
      mode: 'mock',
      locale: 'tr',
      conversationId: requestPayload.conversationId,
      token,
      tokenExpireTime: 1800,
      checkoutFormContent,
      paymentPageUrl: `${requestPayload.callbackUrl}?token=${encodeURIComponent(token)}`,
    };
  }

  const response = await iyzicoRequest({
    config,
    uriPath: IYZICO_ENDPOINTS.CHECKOUT_INITIALIZE,
    payload: requestPayload,
  });

  if (response.status !== 'success') {
    throw AppError.badRequest(
      response.errorMessage || 'İyzico ödeme formu başlatılamadı.',
      response.errorCode || 'IYZICO_INIT_FAILED'
    );
  }

  return { ...response, mode: 'live' };
}

/**
 * 2) İyzico Checkout Form Sonucu Sorgulama (Callback Retrieve)
 */
export async function retrieveCheckoutForm({ restaurant, token, conversationId, mockStatus, expectedPayment }) {
  const config = resolveIyzicoConfig(restaurant);

  if (config.mode === 'mock' || String(token).startsWith('mock_')) {
    const isSuccess = mockStatus !== 'failure';
    const paidTl = kurusToTl((expectedPayment?.amount || 0) + (expectedPayment?.tipAmount || 0));
    return {
      status: 'success',
      mode: 'mock',
      locale: 'tr',
      conversationId,
      token,
      paymentStatus: isSuccess ? 'SUCCESS' : 'FAILURE',
      paymentId: isSuccess ? `mock_pay_${crypto.randomBytes(8).toString('hex')}` : undefined,
      price: paidTl,
      paidPrice: paidTl,
      currency: 'TRY',
      installment: 1,
      cardAssociation: 'MASTER_CARD',
      cardFamily: 'Bonus',
      binNumber: '552879',
      lastFourDigits: '0016',
      itemTransactions: [
        {
          itemId: expectedPayment?._id?.toString() || 'item_1',
          paymentTransactionId: `mock_tx_${crypto.randomBytes(8).toString('hex')}`,
          price: paidTl,
          paidPrice: paidTl,
        },
      ],
      errorCode: isSuccess ? undefined : 'MOCK_DECLINED',
      errorMessage: isSuccess ? undefined : 'Test ödemesi kullanıcı tarafından reddedildi.',
    };
  }

  return iyzicoRequest({
    config,
    uriPath: IYZICO_ENDPOINTS.CHECKOUT_RETRIEVE,
    payload: {
      locale: 'tr',
      conversationId,
      token,
    },
  });
}

/**
 * 3) İyzico Ödeme İadesi (Refund)
 */
export async function refundPaymentTransaction({ restaurant, paymentTransactionId, priceTl, currency = 'TRY', ip = '127.0.0.1', conversationId }) {
  const config = resolveIyzicoConfig(restaurant);

  if (config.mode === 'mock' || String(paymentTransactionId).startsWith('mock_tx_')) {
    return {
      status: 'success',
      mode: 'mock',
      conversationId,
      paymentTransactionId,
      price: priceTl,
      currency,
    };
  }

  const response = await iyzicoRequest({
    config,
    uriPath: IYZICO_ENDPOINTS.REFUND,
    payload: {
      locale: 'tr',
      conversationId,
      paymentTransactionId,
      price: priceTl,
      currency,
      ip,
    },
  });

  if (response.status !== 'success') {
    throw AppError.badRequest(
      response.errorMessage || 'İyzico iade işlemi başarısız oldu.',
      response.errorCode || 'IYZICO_REFUND_FAILED'
    );
  }

  return response;
}
