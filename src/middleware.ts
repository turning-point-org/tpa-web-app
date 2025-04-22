import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Extract the Auth0 token from the request cookies and add it to the request headers
 */
export async function middleware(request: NextRequest) {
  // Skip non-API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Skip Auth0 routes to prevent interference with Auth0's own middleware
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    // Check cookies for Auth0 tokens
    const cookies = request.cookies;
    const hasAuth0Cookie = cookies.has('appSession');
    
    // Log cookie information for debugging
    console.log(`Middleware: Request to ${request.nextUrl.pathname}`);
    console.log(`Middleware: Auth header present: ${!!authHeader}`);
    console.log(`Middleware: Auth0 cookie present: ${hasAuth0Cookie}`);
    console.log(`Middleware: Cookies found: ${cookies.getAll().map(c => c.name).join(', ')}`);
    
    if (hasAuth0Cookie) {
      // Create modified request headers
      const requestHeaders = new Headers(request.headers);
      
      // If no authorization header is present but a session cookie is,
      // indicate that we have a session available
      if (!authHeader) {
        requestHeaders.set('X-Auth0-Session', 'true');
        console.log(`Middleware: Added X-Auth0-Session header`);
      }
      
      // Forward the request with the modified headers
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
      
      return response;
    }
    
    // Continue to the next middleware/route
    return NextResponse.next();
  } catch (error) {
    // Log the error but continue processing the request
    console.error('Middleware auth token processing error:', error);
    return NextResponse.next();
  }
}

// Configure which routes the middleware should run on
export const config = {
  matcher: '/api/:path*'
}; 