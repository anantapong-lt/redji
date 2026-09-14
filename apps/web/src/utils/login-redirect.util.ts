export function loginUrlForCurrentPage(): string {
  if (typeof window === 'undefined') return '/login'

  const returnTo = `${window.location.pathname}${window.location.search}`
  return `/login?next=${encodeURIComponent(returnTo)}`
}
