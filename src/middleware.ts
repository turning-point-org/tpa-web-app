import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Only process API routes that need authentication
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (authHeader) {
      // Log token presence (remove in production)
      console.log('Auth token captured in middleware:', authHeader);
    }
    
    // Simply continue to the next middleware/route
    return NextResponse.next();
  } catch (error) {
    // If there's an error, just continue without the token
    console.error('Middleware auth token capture error:', error);
    return NextResponse.next();
  }
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    // Only run on API routes
    '/api/:path*',
  ],
}; 