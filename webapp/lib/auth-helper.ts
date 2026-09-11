import { auth } from '@/auth';

// Helper to get current user ID across server components and API routes
// Returns user.id if logged in via Google OAuth, or null if in Guest Mode
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const session = await auth();
    if (session?.user?.id) {
      return session.user.id;
    }
  } catch (error) {
    console.error('Error retrieving session in getCurrentUserId:', error);
  }
  return null;
}
