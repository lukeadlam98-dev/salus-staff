import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ── Keep server-only libraries out of the browser bundle ──
// 'web-push' is a Node.js library for SENDING push notifications from a
// server. It relies on Node built-ins (crypto, https) that don't exist in
// the browser, so if any client file imports it the Vite build fails with:
//   "Rollup failed to resolve import 'web-push'"
// This plugin replaces it with a harmless empty stub on the client. The
// real push-sending belongs in a serverless function (Vercel /api route or
// a Supabase Edge Function), never in the React app.
const stubServerOnly = {
  name: 'stub-server-only-libs',
  resolveId(id) {
    if (id === 'web-push') return '\0stub:web-push';
  },
  load(id) {
    if (id === '\0stub:web-push') {
      return [
        'export default {};',
        'export const setVapidDetails = () => {};',
        'export const sendNotification = () => Promise.resolve();',
        'export const generateVAPIDKeys = () => ({});',
      ].join('\n');
    }
  },
};

export default defineConfig({
  plugins: [react(), stubServerOnly],
});
