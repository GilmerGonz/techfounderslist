'use client';

import { useEffect, useRef } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: any) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

/**
 * Renders a Cloudflare Turnstile widget when NEXT_PUBLIC_TURNSTILE_SITE_KEY is
 * set, reporting the issued token via onTokenChange. Returns null (renders
 * nothing) when the site key is absent, so the form stays usable until you
 * configure Turnstile.
 */
export function TurnstileWidget({
  onTokenChange,
  action,
}: {
  onTokenChange: (token: string | null) => void;
  action?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const cbRef = useRef(onTokenChange);
  cbRef.current = onTokenChange;

  useEffect(() => {
    if (!SITE_KEY || widgetIdRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => cbRef.current(token),
        'expired-callback': () => cbRef.current(null),
        'error-callback': () => cbRef.current(null),
        ...(action ? { action } : {}),
      });
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = renderWidget;
    document.body.appendChild(script);
  }, [action]);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className='mt-4' aria-label='Anti-bot verification' />;
}
