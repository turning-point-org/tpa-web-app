import { NextResponse } from 'next/server';

/**
 * API route that checks for Auth0 authentication
 * This helps the client determine if we're authenticated
 */
export async function GET(request: Request) {
  // Check for the Auth0 cookie in the request
  const cookies = request.headers.get('cookie') || '';
  const hasAuth0Session = cookies.includes('appSession=');
  
  if (!hasAuth0Session) {
    return NextResponse.json({ 
      authenticated: false 
    });
  }
  
  return NextResponse.json({
    authenticated: true,
    hasSessionCookie: true
  });
} 