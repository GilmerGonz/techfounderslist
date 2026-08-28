const PAYPAL_BASE =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// Single source of truth for the brand name shown to payers (refund notes,
// idempotency-key prefixes). Keep in sync with the site's actual wordmark
// ("The Tech Founders List" in Navbar.tsx) so customers never see a
// different brand in a PayPal refund note than the one they paid on.
const APP_NAME = 'The Tech Founders List';
const ID_PREFIX = 'tfl';

let cachedToken: { token: string; expiresAt: number } | null = null;

/** Obtiene un OAuth access token de PayPal, cacheado hasta 60s antes de expirar. */
export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal no está configurado. Define PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth falló (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface PayPalBidMeta {
  companyId: string;
  categoryId: string;
  position: string;
  amountCents: string;
}

/**
 * Crea una PayPal Order con el monto y la metadata del bid en custom_id.
 *
 * `vault` pide a PayPal que guarde el método de pago del comprador al
 * completar la captura ("store in vault on success"), sin ningún paso extra
 * para el comprador. El vault id resultante se usa luego para AutoDefend
 * (cobros iniciados por el comercio, sin el comprador presente) — requiere
 * que la cuenta de PayPal del comercio tenga habilitado Vault/Reference
 * Transactions; si no lo tiene, PayPal simplemente no vaultea y el resto del
 * pago sigue funcionando con normalidad.
 */
async function createOrderRequest(
  amountCents: number,
  currency: string,
  meta: PayPalBidMeta,
  opts: { vault?: boolean; returnUrl?: string; cancelUrl?: string }
): Promise<Response> {
  const token = await getPayPalAccessToken();

  return fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': `${ID_PREFIX}-${meta.companyId}-${meta.position}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency.toUpperCase(),
            value: (amountCents / 100).toFixed(2),
          },
          custom_id: JSON.stringify(meta),
        },
      ],
      ...(opts.vault
        ? {
            payment_source: {
              paypal: {
                attributes: {
                  vault: {
                    store_in_vault: 'ON_SUCCESS',
                    usage_type: 'MERCHANT',
                    customer_type: 'CONSUMER',
                  },
                },
                // Required by PayPal whenever vaulting is requested, even
                // though the JS SDK popup flow never actually navigates the
                // buyer to them — PayPal validates their presence regardless.
                experience_context: {
                  return_url: opts.returnUrl,
                  cancel_url: opts.cancelUrl,
                },
              },
            },
          }
        : {}),
    }),
  });
}

export async function createPayPalOrder(
  amountCents: number,
  currency: string,
  meta: PayPalBidMeta,
  opts: { vault?: boolean; returnUrl?: string; cancelUrl?: string } = {}
): Promise<{ id: string }> {
  let res = await createOrderRequest(amountCents, currency, meta, opts);

  // The merchant account may not have Vault/Reference Transactions enabled
  // (common right after switching to Live — sandbox often has it by
  // default). AutoDefend enrollment is a nice-to-have; the actual position
  // claim payment must never fail just because vaulting isn't available.
  if (!res.ok && opts.vault) {
    const err = await res.text();
    if (err.includes('NOT_ENABLED_TO_VAULT_PAYMENT_SOURCE')) {
      console.warn('PayPal: merchant account cannot vault payment sources — retrying without vaulting.');
      res = await createOrderRequest(amountCents, currency, meta, { ...opts, vault: false });
    } else if (!res.ok) {
      throw new Error(`PayPal createOrder falló (${res.status}): ${err}`);
    }
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal createOrder falló (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

/** Sanitiza un orderId/captureId para prevenir inyección en URL paths. */
function sanitizePayPalId(id: string): string {
  // PayPal IDs solo contienen alfanumericos y guiones
  if (!/^[A-Za-z0-9\-]+$/.test(id)) {
    throw new Error('PayPal ID contiene caracteres inválidos');
  }
  return id;
}

/** Captura una Order ya aprobada por el pagador. Devuelve el capture id y la metadata. */
export async function capturePayPalOrder(orderId: string): Promise<{
  captureId: string;
  meta: PayPalBidMeta;
  vaultId?: string;
}> {
  const safeOrderId = sanitizePayPalId(orderId);
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${safeOrderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture falló (${res.status}): ${err}`);
  }

  const data = (await res.json()) as any;
  const captureId: string = data?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? safeOrderId;
  let meta: PayPalBidMeta = {
    companyId: '',
    categoryId: '',
    position: '0',
    amountCents: '0',
  };
  try {
    const raw = data?.purchase_units?.[0]?.custom_id;
    if (raw) meta = JSON.parse(raw) as PayPalBidMeta;
  } catch {
    /* custom_id ausente o inválido */
  }

  // Present only if this order requested vaulting AND the merchant account
  // has Vault/Reference Transactions enabled. Absent otherwise — callers
  // must treat AutoDefend enrollment as unavailable when this is missing.
  const vaultId: string | undefined = data?.payment_source?.paypal?.attributes?.vault?.id;

  return { captureId, meta, vaultId };
}

/**
 * Obtiene los detalles de una Order de PayPal para re-validar el monto
 * antes de capturar. Previene el race condition TOCTOU (P-02).
 */
export async function getPayPalOrderDetails(orderId: string): Promise<{
  status: string;
  amountCents: number;
  currency: string;
  meta: PayPalBidMeta;
}> {
  const safeOrderId = sanitizePayPalId(orderId);
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${safeOrderId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal getOrder falló (${res.status}): ${err}`);
  }

  const data = (await res.json()) as any;
  const pu = data?.purchase_units?.[0];
  const amountValue = parseFloat(pu?.amount?.value ?? '0');
  const amountCents = Math.round(amountValue * 100);
  const currency = pu?.amount?.currency_code ?? 'USD';

  let meta: PayPalBidMeta = {
    companyId: '',
    categoryId: '',
    position: '0',
    amountCents: '0',
  };
  try {
    const raw = pu?.custom_id;
    if (raw) meta = JSON.parse(raw) as PayPalBidMeta;
  } catch {
    /* custom_id ausente o inválido */
  }

  return { status: data.status, amountCents, currency, meta };
}

/**
 * Refund completo de una captura de PayPal.
 * Se usa cuando claimPosition() falla después de capturar el pago (P-01).
 */
export async function refundPayPalCapture(
  captureId: string,
  amountCents?: number,
  currency: string = 'USD',
  note: string = `${APP_NAME}: posición no disponible al momento de la captura.`
): Promise<{ refundId: string }> {
  const safeCaptureId = sanitizePayPalId(captureId);
  const token = await getPayPalAccessToken();

  const body: Record<string, any> = {
    note_to_payer: note,
  };

  // Si se especifica un monto, refund parcial; si no, refund completo
  if (amountCents && amountCents > 0) {
    body.amount = {
      value: (amountCents / 100).toFixed(2),
      currency_code: currency.toUpperCase(),
    };
  }

  const res = await fetch(`${PAYPAL_BASE}/v2/payments/captures/${safeCaptureId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': `${ID_PREFIX}-refund-${safeCaptureId}-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`PayPal refund falló (${res.status}): ${err}`);
    throw new Error(`PayPal refund falló (${res.status}): ${err}`);
  }

  const data = (await res.json()) as { id: string };
  return { refundId: data.id };
}

/**
 * Re-verifies a completed capture against PayPal to confirm the recorded
 * amount and status before mutating the index. Prevents accepting a webhook
 * whose embedded metadata was tampered with (audit §2).
 */
export async function getPayPalCaptureDetails(captureId: string): Promise<{
  status: string;
  amountCents: number;
  currency: string;
}> {
  const safeCaptureId = sanitizePayPalId(captureId);
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/payments/captures/${safeCaptureId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal getCapture failed (${res.status}): ${err}`);
  }

  const data = (await res.json()) as any;
  const amountValue = parseFloat(data?.amount?.value ?? '0');
  const amountCents = Math.round(amountValue * 100);

  return {
    status: data.status,
    amountCents,
    currency: data?.amount?.currency_code ?? 'USD',
  };
}

/** Verifica la firma de un webhook de PayPal contra la Verification API. */
export async function verifyPayPalWebhook(
  headers: Record<string, string | null>,
  rawBody: string
): Promise<boolean> {
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionTime = headers['paypal-transmission-time'];
  const certUrl = headers['paypal-cert-url'];
  const sig = headers['paypal-transmission-sig'];
  const authAlgo = headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionTime || !certUrl || !sig || !authAlgo) {
    return false;
  }

  try {
    const token = await getPayPalAccessToken();
    const res = await fetch(`${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: sig,
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: JSON.parse(rawBody),
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { verification_status: string };
    return data.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}

/**
 * AutoDefend: merchant-initiated charge against a previously vaulted PayPal
 * payment token — no buyer redirect, no buyer present. Requires the merchant
 * PayPal account to have Vault/Reference Transactions enabled; if it
 * doesn't, PayPal rejects this call and the caller must disable the
 * subscription rather than retry (see disableAutoDefendOnPaymentError in
 * lib/autoDefend.ts).
 */
export async function chargeVaultedPayPal(
  vaultId: string,
  amountCents: number,
  currency: string,
  meta: PayPalBidMeta
): Promise<{ captureId: string }> {
  const token = await getPayPalAccessToken();

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'PayPal-Request-Id': `${ID_PREFIX}-autodefend-${meta.companyId}-${meta.position}-${Date.now()}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency.toUpperCase(),
            value: (amountCents / 100).toFixed(2),
          },
          custom_id: JSON.stringify(meta),
        },
      ],
      payment_source: {
        paypal: {
          vault_id: vaultId,
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal AutoDefend charge falló (${res.status}): ${err}`);
  }

  const data = (await res.json()) as any;
  // A vault-token order with no buyer present is captured synchronously by
  // PayPal in this same response — there is no separate approval/capture step.
  if (data?.status !== 'COMPLETED') {
    throw new Error(`PayPal AutoDefend charge no se completó (status: ${data?.status}).`);
  }
  const captureId: string = data?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? '';

  if (!captureId) {
    throw new Error('PayPal AutoDefend charge: no se recibió un capture id.');
  }

  return { captureId };
}
