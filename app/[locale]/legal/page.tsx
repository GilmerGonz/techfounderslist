import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service & Refund Policy — The Tech Founders List',
};

/**
 * Terms of Service + Refund/Claims Policy. Authored in English (canonical)
 * and Spanish; other locales fall back to English rather than shipping an
 * unreviewed machine translation of a legal document.
 */
export default function LegalPage({ params: { locale } }: { params: { locale: string } }) {
  return locale === 'es' ? <SpanishLegalContent locale={locale} /> : <EnglishLegalContent locale={locale} />;
}

function Shell({ locale, children }: { locale: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-ink sm:px-8">
      <Link href={`/${locale}`} className="text-xs font-medium text-ink-60 hover:text-ink">
        ← The Tech Founders List
      </Link>
      <div className="prose-legal mt-8 space-y-10 text-sm leading-relaxed text-ink-80">
        {children}
      </div>
    </main>
  );
}

function EnglishLegalContent({ locale }: { locale: string }) {
  return (
    <Shell locale={locale}>
      <header>
        <h1 className="font-display text-3xl font-bold text-ink">Terms of Service & Refund Policy</h1>
        <p className="mt-2 text-xs text-ink-60">Last updated: {new Date().toISOString().slice(0, 10)}</p>
      </header>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">1. What this is</h2>
        <p className="mt-2">
          The Tech Founders List (&quot;the Index&quot;, &quot;we&quot;, &quot;us&quot;) is a paid ranking: within
          each category, a limited number of positions are held by whichever listed company has committed
          the highest amount of capital for that spot. Any company may reclaim (&quot;outbid&quot;) a held
          position at any time by paying at least the minimum increment above the amount currently held.
          Doing so immediately displaces the previous holder to the next position.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">2. How a claim works</h2>
        <ul className="mt-2 list-disc space-y-1.5 ps-5">
          <li>The minimum to claim an empty position is $1.00 USD. The minimum to outbid a held position is the current amount plus $1.00 USD.</li>
          <li>Payments are processed exclusively through PayPal. We never see or store your full payment details.</li>
          <li>A position is only transferred once your payment is captured and confirmed server-side — never on submission alone.</li>
          <li>If the position&apos;s price rose (someone else outbid it) between your quote and your payment clearing, your payment is automatically refunded in full and no position changes hands.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">3. Refund policy</h2>
        <p className="mt-2 font-semibold text-ink">
          A successfully claimed position is not refundable. This is the core mechanic of the product, not
          a limitation of it: you are paying to hold a position for as long as no one outbids you, and that
          value is delivered the moment the claim is confirmed — not over time.
        </p>
        <p className="mt-2">Refunds are issued automatically, without you needing to request one, only when:</p>
        <ul className="mt-2 list-disc space-y-1.5 ps-5">
          <li>your payment cleared for an amount that turned out to be below the minimum required at that moment (a pricing race with another claimant), or</li>
          <li>the position could not be recorded due to a technical failure on our end after your payment was captured.</li>
        </ul>
        <p className="mt-2">
          If a refund is owed but our automatic refund fails, this is logged for manual review; contact us
          with your payment reference and we will resolve it.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">4. No guarantee of outcome</h2>
        <p className="mt-2">
          We do not guarantee any specific amount of traffic, visibility, leads, or business outcome from
          holding a position. The Index is a ranking mechanism, not an advertising performance product.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">5. Company listings</h2>
        <p className="mt-2">
          By submitting a company, you confirm you are authorized to represent it and that the information
          provided (name, URL, description, logo) is accurate and not infringing. We may remove listings
          that are fraudulent, spam, or unlawful, without refunding any amount already committed to that
          position, at our discretion.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">6. AutoDefend (optional)</h2>
        <p className="mt-2">
          If you enable AutoDefend for a position, you authorize us to automatically charge your saved
          PayPal payment method, without your presence, to reclaim that exact position if someone outbids
          you — up to (and never beyond) the ceiling you set. You may disable AutoDefend at any time; it
          does not refund past auto-charges, which are subject to the same refund policy as any other claim
          above. If an auto-charge fails, AutoDefend is automatically disabled for that position.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">7. Contact</h2>
        <p className="mt-2">
          For payment disputes or refund follow-ups, contact us with your PayPal payment reference (shown
          on your PayPal receipt) and the position/category affected.
        </p>
      </section>
    </Shell>
  );
}

function SpanishLegalContent({ locale }: { locale: string }) {
  return (
    <Shell locale={locale}>
      <header>
        <h1 className="font-display text-3xl font-bold text-ink">Términos de Servicio y Política de Reembolso</h1>
        <p className="mt-2 text-xs text-ink-60">Última actualización: {new Date().toISOString().slice(0, 10)}</p>
      </header>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">1. Qué es esto</h2>
        <p className="mt-2">
          The Tech Founders List (&quot;el Índice&quot;, &quot;nosotros&quot;) es un ranking de pago: dentro de cada
          categoría, un número limitado de posiciones son ocupadas por la empresa que haya comprometido el
          monto más alto de capital para ese puesto. Cualquier empresa puede reclamar (&quot;pujar por
          encima&quot;) una posición ocupada en cualquier momento, pagando al menos el incremento mínimo por
          encima del monto actual. Hacerlo desplaza inmediatamente al titular anterior a la siguiente
          posición.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">2. Cómo funciona un reclamo</h2>
        <ul className="mt-2 list-disc space-y-1.5 ps-5">
          <li>El mínimo para reclamar una posición vacía es $1.00 USD. El mínimo para superar una posición ocupada es el monto actual más $1.00 USD.</li>
          <li>Los pagos se procesan exclusivamente a través de PayPal. Nunca vemos ni almacenamos tus datos completos de pago.</li>
          <li>Una posición solo se transfiere una vez que tu pago es capturado y confirmado del lado del servidor — nunca solo al enviarlo.</li>
          <li>Si el precio de la posición subió (alguien más pujó por encima) entre tu cotización y la confirmación de tu pago, tu pago se reembolsa automáticamente en su totalidad y ninguna posición cambia de manos.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">3. Política de reembolso</h2>
        <p className="mt-2 font-semibold text-ink">
          Una posición reclamada exitosamente no es reembolsable. Este es el mecanismo central del producto,
          no una limitación: pagas por ocupar una posición mientras nadie te supere, y ese valor se entrega
          en el momento en que se confirma el reclamo — no a lo largo del tiempo.
        </p>
        <p className="mt-2">Los reembolsos se emiten automáticamente, sin que tengas que solicitarlos, únicamente cuando:</p>
        <ul className="mt-2 list-disc space-y-1.5 ps-5">
          <li>tu pago se confirmó por un monto que resultó estar por debajo del mínimo requerido en ese momento (una carrera de precio con otro reclamante), o</li>
          <li>la posición no pudo registrarse debido a una falla técnica de nuestro lado después de que tu pago fue capturado.</li>
        </ul>
        <p className="mt-2">
          Si se debe un reembolso pero nuestro reembolso automático falla, esto queda registrado para
          revisión manual; contáctanos con tu referencia de pago y lo resolveremos.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">4. Sin garantía de resultados</h2>
        <p className="mt-2">
          No garantizamos ninguna cantidad específica de tráfico, visibilidad, leads o resultado de negocio
          por ocupar una posición. El Índice es un mecanismo de ranking, no un producto de rendimiento
          publicitario.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">5. Listados de empresas</h2>
        <p className="mt-2">
          Al enviar una empresa, confirmas que estás autorizado para representarla y que la información
          proporcionada (nombre, URL, descripción, logo) es precisa y no infringe derechos de terceros.
          Podemos eliminar listados fraudulentos, spam o ilegales, sin reembolsar ningún monto ya
          comprometido en esa posición, a nuestra discreción.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">6. AutoDefend (opcional)</h2>
        <p className="mt-2">
          Si activas AutoDefend para una posición, nos autorizas a cobrar automáticamente tu método de pago
          de PayPal guardado, sin tu presencia, para recuperar esa posición exacta si alguien te supera —
          hasta (y nunca más allá de) el tope que definas. Puedes desactivar AutoDefend en cualquier
          momento; esto no reembolsa cobros automáticos pasados, que están sujetos a la misma política de
          reembolso que cualquier otro reclamo descrita arriba. Si un cobro automático falla, AutoDefend se
          desactiva automáticamente para esa posición.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink">7. Contacto</h2>
        <p className="mt-2">
          Para disputas de pago o seguimiento de reembolsos, contáctanos con tu referencia de pago de PayPal
          (que aparece en tu recibo de PayPal) y la posición/categoría afectada.
        </p>
      </section>
    </Shell>
  );
}
