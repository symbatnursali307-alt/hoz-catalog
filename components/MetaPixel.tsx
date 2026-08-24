'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function MetaPixel({ pixelId }: { pixelId: string | null }) {
  const pathname = usePathname();
  const lastPath = useRef('');

  const isTestVisit = () =>
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('test') === '1' || localStorage.getItem('catalog_is_test') === '1');

  useEffect(() => {
    if (!pixelId || pathname.startsWith('/admin') || isTestVisit() || lastPath.current === pathname || typeof window.fbq !== 'function') return;
    lastPath.current = pathname;
    window.fbq?.('track', 'PageView');
  }, [pathname, pixelId]);

  if (!pixelId) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        onLoad={() => {
          if (!pathname.startsWith('/admin') && !isTestVisit() && lastPath.current !== pathname) {
            lastPath.current = pathname;
            window.fbq?.('track', 'PageView');
          }
        }}
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?` +
            `n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;` +
            `n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;` +
            `t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}` +
            `(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');` +
            `fbq('init',${JSON.stringify(pixelId)});`,
        }}
      />
    </>
  );
}
