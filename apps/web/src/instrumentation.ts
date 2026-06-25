export async function register() {
  // Validates required environment variables at server startup —
  // throws and prevents the server from serving requests if any are missing.
  await import('./lib/env')
}
