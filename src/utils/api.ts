import { useUser } from '@auth0/nextjs-auth0/client';

// Helper function to check if a URL is an auth route
const isAuthRoute = (url: string) => {
  return url.includes('/api/auth/');
};

// Custom fetch function that automatically adds auth headers
export const fetchWithAuth = async (url: string, token: string | undefined, options: RequestInit = {}) => {
  // Don't add auth headers to auth routes
  if (isAuthRoute(url)) {
    return fetch(url, options);
  }

  // Add authorization header if we have a token
  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}; 