import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/utils/api-handler';
import { getSessionServer } from '@/utils/auth';

/**
 * Test endpoint to verify user details can be accessed in API routes
 */
async function handler(req: NextRequest) {
  try {
    // Try to get user session details in the API route
    const session = await getSessionServer(req);
    
    if (session && session.user) {
      console.log('API Route: User session found:', {
        userId: session.user.sub,
        email: session.user.email,
        name: session.user.name
      });
      
      return NextResponse.json({
        success: true,
        message: "User authenticated successfully",
        user: {
          userId: session.user.sub,
          email: session.user.email,
          name: session.user.name,
          picture: session.user.picture,
          emailVerified: session.user.email_verified
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('API Route: No user session found');
      return NextResponse.json({
        success: false,
        message: "No user session found",
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('API Route: Error getting user session:', error);
    return NextResponse.json({
      success: false,
      message: "Error getting user session",
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Wrap the handler with our authentication middleware
export const GET = withAuth(handler);
