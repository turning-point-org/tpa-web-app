import { NextRequest, NextResponse } from 'next/server';

/**
 * API route handler wrapper that checks for Auth0 authentication
 * via session cookie (through headers set by middleware)
 */
export function withAuth(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    // Check if the request has Authorization header
    const authHeader = req.headers.get('authorization');
    
    // Check for the special header that indicates Auth0 session
    const hasAuth0Session = req.headers.get('X-Auth0-Session') === 'true';
    
    if (!authHeader && !hasAuth0Session) {
      console.log('API request denied - no authorization header or Auth0 session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (hasAuth0Session) {
      // We've verified an Auth0 session exists through middleware
      console.log('Request authenticated via Auth0 session cookie');
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      // We have a token in the Authorization header
      console.log('Request authenticated via Authorization header');
    }
    
    // Pass the request to the handler
    return handler(req);
  };
} 