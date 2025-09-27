import { NextRequest, NextResponse } from 'next/server';

/**
 * API route handler wrapper that checks for Auth0 authentication
 * via session cookie (through headers set by middleware)
 */
export function withAuth(handler: (req: NextRequest, user?: any) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    // Check if the request has Authorization header
    const authHeader = req.headers.get('authorization');
    
    // Check for the special header that indicates Auth0 session
    const hasAuth0Session = req.headers.get('X-Auth0-Session') === 'true';
    
    if (!authHeader && !hasAuth0Session) {
      console.log('API request denied - no authorization header or Auth0 session');
      return NextResponse.json(
        { 
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        },
        { status: 401 }
      );
    }
    
    let user = null;
    
    // Always try to extract user details from headers set by middleware
    const userId = req.headers.get('X-User-Id');
    const userEmail = req.headers.get('X-User-Email');
    const userName = req.headers.get('X-User-Name');
    
    if (userId && userEmail) {
      user = {
        userId,
        email: userEmail,
        name: userName || userEmail
      };
      console.log('Request authenticated - User details from middleware headers:', user.email);
    }
    
    if (hasAuth0Session) {
      console.log('Request authenticated via Auth0 session cookie');
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      console.log('Request authenticated via Authorization header');
    }
    
    // Pass the request and user to the handler
    return handler(req, user);
  };
} 