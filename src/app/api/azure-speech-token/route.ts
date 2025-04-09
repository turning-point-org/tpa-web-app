import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get Azure Speech Service credentials from environment variables
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    
    if (!key || !region) {
      return NextResponse.json(
        { error: 'Azure Speech Service credentials not configured' },
        { status: 500 }
      );
    }
    
    // Return the credentials to the client
    return NextResponse.json({ key, region });
  } catch (error) {
    console.error('Error fetching Azure Speech Service token:', error);
    return NextResponse.json(
      { error: 'Failed to get Azure Speech Service token' },
      { status: 500 }
    );
  }
} 