import { useUser } from '@auth0/nextjs-auth0/client';

// Custom error class for authentication errors
export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Custom error class for session expiration
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please log in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * Handles authentication errors by redirecting to login page
 */
export const handleAuthError = (error: any) => {
  console.error('Authentication error:', error);
  
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Clear any stored session data
    try {
      localStorage.removeItem('userToken');
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear storage:', e);
    }
    
    // Redirect to login page
    window.location.href = '/api/auth/login';
  }
};

/**
 * Checks if an error or response indicates authentication failure
 */
export const isAuthError = (errorOrResponse: any): boolean => {
  // Check if it's a Response object
  if (errorOrResponse instanceof Response) {
    return errorOrResponse.status === 401 || errorOrResponse.status === 403;
  }
  
  // Check if it's an error object
  if (errorOrResponse instanceof Error) {
    return errorOrResponse.name === 'AuthenticationError' || 
           errorOrResponse.name === 'SessionExpiredError' ||
           errorOrResponse.message.toLowerCase().includes('unauthorized') ||
           errorOrResponse.message.toLowerCase().includes('not authenticated');
  }
  
  // Check if it's an error response object
  if (errorOrResponse && typeof errorOrResponse === 'object') {
    const status = errorOrResponse.status || errorOrResponse.statusCode;
    const message = errorOrResponse.message || errorOrResponse.error || '';
    
    return status === 401 || 
           status === 403 || 
           message.toLowerCase().includes('unauthorized') ||
           message.toLowerCase().includes('not authenticated');
  }
  
  return false;
};

// Helper function to check if a URL is an auth route
const isAuthRoute = (url: string) => {
  return url.includes('/api/auth/');
};

/**
 * Custom fetch function that automatically adds auth headers and handles auth errors
 * @param url URL to fetch
 * @param token Auth0 access token (from user.accessToken)
 * @param options Fetch options
 */
export const fetchWithAuth = async (url: string, token: string | undefined, options: RequestInit = {}): Promise<Response> => {
  // Don't add auth headers to auth routes
  if (isAuthRoute(url)) {
    const response = await fetch(url, options);
    
    // Check for auth errors even on auth routes
    if (isAuthError(response)) {
      handleAuthError(response);
      throw new SessionExpiredError();
    }
    
    return response;
  }

  // Debug info for token status
  if (token) {
    console.log(`Token available for ${url.split('?')[0]}`);
  } else {
    console.log(`No token available for: ${url.split('?')[0]}`);
    
    // For now, temporarily allow calls without tokens for debugging
    console.log('WARNING: Proceeding with fetch without token for debugging purposes');
  }

  // Create a new Headers object for better type safety
  const headers = new Headers(options.headers);
  
  // Add authorization header if token exists and is not empty
  if (token && token.trim() !== '') {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // For debugging the actual headers being sent
  console.log('Request headers:', [...headers.keys()]);

  try {
    // Make the fetch request
    const response = await fetch(url, {
      ...options,
      headers,
      // Include credentials to send cookies
      credentials: 'include'
    });

    // Check for authentication errors
    if (isAuthError(response)) {
      console.log(`Authentication error on ${url}: ${response.status} ${response.statusText}`);
      
      // Try to get error details from response
      let errorMessage = 'Your session has expired. Please log in again.';
      try {
        const errorData = await response.clone().json();
        if (errorData.error && typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Use default message if we can't parse response
      }
      
      const error = new SessionExpiredError(errorMessage);
      handleAuthError(error);
      throw error;
    }

    return response;
  } catch (error) {
    // Handle network errors and other fetch errors
    if (error instanceof SessionExpiredError || error instanceof AuthenticationError) {
      throw error; // Re-throw auth errors
    }
    
    // For other errors, check if they might be auth-related
    if (isAuthError(error)) {
      const authError = new SessionExpiredError();
      handleAuthError(authError);
      throw authError;
    }
    
    // Re-throw non-auth errors
    throw error;
  }
};

/**
 * Wrapper for regular fetch calls that handles auth errors
 * Use this for components that make direct fetch calls without fetchWithAuth
 */
export const handleFetchResponse = async (response: Response): Promise<Response> => {
  if (isAuthError(response)) {
    console.log(`Authentication error: ${response.status} ${response.statusText}`);
    
    // Try to get error details from response
    let errorMessage = 'Your session has expired. Please log in again.';
    try {
      const errorData = await response.clone().json();
      if (errorData.error && typeof errorData.error === 'string') {
        errorMessage = errorData.error;
      }
    } catch (e) {
      // Use default message if we can't parse response
    }
    
    const error = new SessionExpiredError(errorMessage);
    handleAuthError(error);
    throw error;
  }
  
  return response;
};

/**
 * Wrapper for try-catch blocks to handle auth errors in async functions
 */
export const withAuthErrorHandling = async <T>(
  asyncFn: () => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> => {
  try {
    return await asyncFn();
  } catch (error) {
    if (isAuthError(error)) {
      handleAuthError(error);
      return fallbackValue;
    }
    throw error; // Re-throw non-auth errors
  }
}; 