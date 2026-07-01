// Single source of truth for role → landing-route mapping. Framework-free so it
// can be unit-tested with Node's built-in test runner and reused by the router
// and the API service.

export function dashboardForRole(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return '/admin-dashboard';
  if (normalized === 'doctor') return '/doc-dashboard';
  if (normalized === 'nurse') return '/nurse-dashboard';
  if (normalized === 'pharmacist') return '/pharmacist-dashboard';
  return '/patient';
}
