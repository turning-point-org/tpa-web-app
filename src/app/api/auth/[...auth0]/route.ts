import { handleAuth, handleLogout } from '@auth0/nextjs-auth0';

export const GET = handleAuth({
  logout: handleLogout({
    returnTo: process.env.AUTH0_BASE_URL,
  }),
});
