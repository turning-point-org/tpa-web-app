import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get Azure Speech Service credentials from environment variables
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;
    
    if (!key) {
      return NextResponse.json(
        { error: 'Azure Speech Service key not configured' },
        { status: 500 }
      );
    }
    
    if (!region) {
      return NextResponse.json(
        { error: 'Azure Speech Service region not configured' },
        { status: 500 }
      );
    }
    
    // Validate region format - should be lowercase without spaces
    const validRegion = region.toLowerCase().trim();
    
    // Return the credentials to the client with the normalized region
    return NextResponse.json({ key, region: validRegion });
  } catch (error) {
    console.error('Error fetching Azure Speech Service token:', error);
    return NextResponse.json(
      { error: 'Failed to get Azure Speech Service token' },
      { status: 500 }
    );
  }
} 