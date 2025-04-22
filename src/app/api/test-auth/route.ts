import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/utils/api-handler';

/**
 * Protected API endpoint that requires authentication
 */
async function handler(req: NextRequest) {
  // This will only execute if the request is authenticated
  return NextResponse.json({
    message: "You are authenticated!",
    path: req.nextUrl.pathname,
    method: req.method,
    timestamp: new Date().toISOString()
  });
}

// Wrap the handler with our authentication middleware
export const GET = withAuth(handler); 