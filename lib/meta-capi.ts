import { createHash } from 'node:crypto';

export const META_EVENT_NAMES: Record<string, string> = {
  product_viewed: 'ViewContent',
  add_to_cart: 'AddToCart',
  cart_opened: 'InitiateCheckout',
  phone_entered: 'Lead',
  whatsapp_clicked: 'Contact',
};

export function sha256(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface MetaEventInput {
  eventName: string;
  eventId: string;
  eventSourceUrl: string;
  visitorId: string;
  phone?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  value?: number;
  contentIds?: string[];
  isTest?: boolean;
}

export async function sendMetaEvent(input: MetaEventInput) {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim();
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim();
  const mappedName = META_EVENT_NAMES[input.eventName];
  if (!mappedName || !pixelId || !accessToken || !graphVersion) {
    return { skipped: true as const, eventName: mappedName || null };
  }
  if (input.isTest && !testEventCode) {
    return { skipped: true as const, eventName: mappedName, reason: 'test-event-code-not-configured' as const };
  }

  const userData: Record<string, unknown> = {
    external_id: [sha256(input.visitorId)],
  };
  if (input.phone) userData.ph = [sha256(input.phone.replace(/\D/g, ''))];
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const event = {
    event_name: mappedName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    action_source: 'website',
    user_data: userData,
    custom_data: {
      currency: 'KZT',
      ...(typeof input.value === 'number' && Number.isFinite(input.value) ? { value: input.value } : {}),
      ...(input.contentIds?.length ? { content_ids: input.contentIds, content_type: 'product' } : {}),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [event],
        ...(input.isTest && testEventCode
          ? { test_event_code: testEventCode }
          : {}),
      }),
      signal: controller.signal,
    });
    const responseBody = await response.text();
    if (!response.ok) throw new Error(`Meta CAPI ${response.status}: ${responseBody.slice(0, 1_000)}`);
    return { skipped: false as const, eventName: mappedName, response: responseBody.slice(0, 2_000) };
  } finally {
    clearTimeout(timeout);
  }
}
