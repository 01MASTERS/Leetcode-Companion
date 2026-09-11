// Helper to get current user ID across API routes
// In Phase 1, defaults to 'default-user' so all functionality works immediately
// In Phase 2, this will be connected to Auth.js session

export async function getCurrentUserId(): Promise<string> {
  // Can be extended with cookies/headers or Auth.js session in Phase 2
  return 'default-user';
}
