import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
 
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
 
export const config = {
  matcher: [
    /*
     * Run on every route except static assets and image optimization files,
     * so every Server Component / Server Action gets a fresh auth session.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf)$).*)',
  ],
};