import { handleAuth, handleLogout } from '@auth0/nextjs-auth0';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ auth0: string[] }> }
) {
  // Await the params before using them.
  const resolvedParams = await params;
  
  // Log that Auth0 route was called for debugging
  console.log('Auth0 route called:', request.url);
  
  return handleAuth({
    logout: handleLogout({
      returnTo: process.env.AUTH0_BASE_URL,
    }),
  })(request, { params: resolvedParams });
}
