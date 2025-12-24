import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/embed')) {
    const response = NextResponse.next();
    const csp = [
      "frame-ancestors *",
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.tradingview.com",
      "style-src 'self' 'unsafe-inline' https://*.tradingview.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      "frame-src 'self' https://*.tradingview.com",
    ].join('; ');
    
    response.headers.set('Content-Security-Policy', csp);
    
    response.headers.set('X-Frame-Options', 'ALLOWALL');
    
      response.headers.set('X-Content-Type-Options', 'nosniff');
      
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
    
    const permissionsPolicy = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
      'payment=()',
      'usb=()',
      'serial=()',
      'bluetooth=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', ');
    response.headers.set('Permissions-Policy', permissionsPolicy);
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/embed/:path*',
};

