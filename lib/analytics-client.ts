'use client';

const VISITOR_KEY = 'catalog_visitor_id';
const SESSION_KEY = 'catalog_session';
const UTM_KEY = 'catalog_utm';
const TEST_KEY = 'catalog_is_test';
const SESSION_TTL = 30 * 60 * 1000;

const META_EVENT_NAMES: Record<string, string> = {
  product_viewed: 'ViewContent',
  add_to_cart: 'AddToCart',
  cart_opened: 'InitiateCheckout',
  phone_entered: 'Lead',
  whatsapp_clicked: 'Contact',
};

export interface AnalyticsPayload {
  managerId?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  cartTotal?: number;
  itemsCount?: number;
  contentIds?: string[];
  phone?: string;
  metadata?: Record<string, unknown>;
}

function createId(prefix: string) {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${id}`;
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = createId('v');
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function getSessionId() {
  const now = Date.now();
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (stored?.id && Number(stored.lastSeen) + SESSION_TTL > now) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: stored.id, lastSeen: now }));
      return stored.id as string;
    }
  } catch {
    // A new session replaces corrupt local data.
  }
  const id = createId('s');
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id, lastSeen: now }));
  return id;
}

export function captureAttribution(search = window.location.search) {
  const params = new URLSearchParams(search);
  const current = {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    content: params.get('utm_content') || '',
    term: params.get('utm_term') || '',
  };
  if (Object.values(current).some(Boolean)) localStorage.setItem(UTM_KEY, JSON.stringify(current));
  if (params.get('test') === '1') localStorage.setItem(TEST_KEY, '1');
  return current;
}

export function getStoredAttribution() {
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function getAnalyticsIdentity() {
  return { visitorId: getVisitorId(), sessionId: getSessionId() };
}

export function trackCatalogEvent(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin')) return '';
  const eventId = createId('evt');
  const { visitorId, sessionId } = getAnalyticsIdentity();
  const utm = getStoredAttribution();
  const metaEventName = META_EVENT_NAMES[eventName];
  const isTest = localStorage.getItem(TEST_KEY) === '1';

  if (!isTest && metaEventName && typeof window.fbq === 'function') {
    const pixelPayload = {
      currency: 'KZT',
      ...(typeof payload.cartTotal === 'number' ? { value: payload.cartTotal } : {}),
      ...(payload.contentIds?.length ? { content_ids: payload.contentIds, content_type: 'product' } : {}),
    };
    window.fbq('track', metaEventName, pixelPayload, { eventID: eventId });
  }

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      eventId,
      visitorId,
      sessionId,
      ...payload,
      utm,
      fbp: readCookie('_fbp') || null,
      fbc: readCookie('_fbc') || null,
      isTest,
      eventSourceUrl: window.location.href,
    }),
  }).catch(() => {});
  return eventId;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}
