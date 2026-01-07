import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0/edge';

/**
 * Extract the Auth0 token from the request cookies and add it to the request headers
 */
export async function middleware(request: NextRequest) {
  console.log(`=== MIDDLEWARE: ${request.method} ${request.nextUrl.pathname} ===`);
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

    console.log(`Middleware: Auth header: ${!!authHeader}, Cookie: ${hasAuth0Cookie}`);
    
    // Log cookie information for debugging
    console.log(`Middleware: Request to ${request.nextUrl.pathname}`);
    console.log(`Middleware: Auth header present: ${!!authHeader}`);
    console.log(`Middleware: Auth0 cookie present: ${hasAuth0Cookie}`);
    console.log(`Middleware: Cookies found: ${cookies.getAll().map(c => c.name).join(', ')}`);
    
    if (hasAuth0Cookie) {
      // Try to get user details from the Auth0 session
      let userDetails = null;
      try {
        // Create a temporary response for the session call
        const tempResponse = NextResponse.next();
        const session = await getSession(request, tempResponse);
        
        if (session && session.user) {
          userDetails = {
            userId: session.user.sub,
            email: session.user.email,
            name: session.user.name,
            picture: session.user.picture,
            emailVerified: session.user.email_verified
          };
          
          console.log(`Middleware: User authenticated - Details:`, userDetails);
        } else {
          console.log(`Middleware: Auth0 cookie present but no session/user found`);
        }
      } catch (sessionError) {
        console.error('Middleware: Error getting session details:', sessionError);
        
        // If we can't get session details but have a cookie, it might be expired
        // Clear the session header to prevent false positives
        console.log('Middleware: Session cookie present but session invalid - potential expiration');
      }
      
      // Create modified request headers
      const requestHeaders = new Headers(request.headers);
      
      // If no authorization header is present but a session cookie is,
      // indicate that we have a session available
      if (!authHeader) {
        requestHeaders.set('X-Auth0-Session', 'true');
        console.log(`Middleware: Added X-Auth0-Session header`);
      }
      
      // Add user details to headers for API routes to access
      if (userDetails) {
        requestHeaders.set('X-User-Id', userDetails.userId);
        requestHeaders.set('X-User-Email', userDetails.email);
        requestHeaders.set('X-User-Name', userDetails.name || '');
        console.log(`Middleware: Added user details to request headers`);
      }
      
      // Forward the request with the modified headers
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      console.log('Middleware: Allowing request to proceed');
      
      return response;
    }
    console.log('Middleware: Allowing request to proceed');
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