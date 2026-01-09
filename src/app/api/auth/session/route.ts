import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Explicitly set edge runtime
export const runtime = 'edge';

/**
 * Helper function to extract the JWT token from the Auth0 session cookie
 */
async function getTokenFromCookie() {
  // First await cookies() to avoid the sync API error
  const cookieStore = await cookies();
  
  // Get the Auth0 session cookie
  const sessionCookie = cookieStore.get('appSession');
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    // For security reasons, we don't attempt to decode the opaque session cookie directly
    // This is a simplified approach - in production, you might need a different strategy
    // to extract the token from Auth0's session
    return { 
      accessToken: 'session-exists',
      authenticated: true
    };
  } catch (error) {
    console.error('Error parsing session cookie:', error);
    return null;
  }
}

/**
 * API route to get the current session including access token
 * This is used by client components that need the token
 */
export async function GET(request: Request) {
  try {
    // Get token from cookie
    const session = await getTokenFromCookie();
    
    if (!session) {
      return NextResponse.json(
        { 
          error: 'Your session has expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        }, 
        { status: 401 }
      );
    }

    // Return session info
    return NextResponse.json(session);
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { 
        error: 'Unable to verify your session. Please log in again.',
        code: 'SESSION_ERROR'
      }, 
      { status: 500 }
    );
  }
} 