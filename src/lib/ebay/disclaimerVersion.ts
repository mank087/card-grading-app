// Bump when disclaimer text changes to force users to re-accept.
// Lives here (not in the route file) because Next.js route modules may only
// export HTTP handlers/config — a stray export fails the type-checked build.
export const CURRENT_DISCLAIMER_VERSION = '1.0';
