// The whole Vercel adapter. The server build exports a web-standard
// `{ fetch(request) }` handler, which is what Vercel Functions accept.
// vercel.json serves dist/client and rewrites everything else here. See ADR 0014.
export { default } from '../dist/server/server.js'
