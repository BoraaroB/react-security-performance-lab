// Every URL of the app in one place: links and redirects use PATHS.x instead of a string,
// so a typo does not compile and changing a URL is a one-line change.
export const PATHS = {
  home: '/',
  components: '/components',
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  admin: '/admin',
} as const;
