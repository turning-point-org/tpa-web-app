import { useUser } from '@auth0/nextjs-auth0/client';

// Custom error class for authentication errors
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Helper function to check if a URL is an auth route
const isAuthRoute = (url: string) => {
  return url.includes('/api/auth/');
};

/**
 * Custom fetch function that automatically adds auth headers
 * @param url URL to fetch
 * @param token Auth0 access token (from user.accessToken)
 * @param options Fetch options
 */
export const fetchWithAuth = async (url: string, token: string | undefined, options: RequestInit = {}) => {
  // Don't add auth headers to auth routes
  if (isAuthRoute(url)) {
    return fetch(url, options);
  }

  // Debug info for token status
  if (token) {
    console.log(`Token available for ${url.split('?')[0]}`);
  } else {
    console.log(`No token available for: ${url.split('?')[0]}`);
    
    // For now, temporarily allow calls without tokens for debugging
    console.log('WARNING: Proceeding with fetch without token for debugging purposes');
    // Return fetch without auth headers
    return fetch(url, {
      ...options,
      credentials: 'include'
    });
    
    // Once we fix the token issue, uncomment this to enforce token requirement
    // return Promise.reject(new AuthenticationError());
  }

  // Create a new Headers object for better type safety
  const headers = new Headers(options.headers);
  
  // Add authorization header if token exists and is not empty
  if (token && token.trim() !== '') {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // For debugging the actual headers being sent
  console.log('Request headers:', [...headers.keys()]);

  // Return the fetch with properly typed headers
  return fetch(url, {
    ...options,
    headers,
    // Include credentials to send cookies
    credentials: 'include'
  });
}; 