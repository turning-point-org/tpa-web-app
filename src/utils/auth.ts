import { getSession } from '@auth0/nextjs-auth0';
import { NextRequest } from 'next/server';

/**
 * Extract the access token from the request headers
 * This works for both client-side fetchWithAuth and direct API calls
 */
export const extractToken = (request: NextRequest | Request): string | null => {
  // First check for Authorization header (used by client fetchWithAuth)
  const authHeader = 
    'get' in request.headers 
      ? request.headers.get('authorization')
      : request.headers.get('Authorization');
      
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Log that we couldn't find a token in the authorization header
  console.log('No token found in Authorization header');
  
  return null;
};

/**
 * Server-side utility to get the current user session
 */
export const getSessionServer = async (req: Request) => {
  try {
    const session = await getSession(req, { checkSession: true });
    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}; 