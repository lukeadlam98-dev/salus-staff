// /api/oauth-start.js
// Kicks off the Gmail OAuth flow.
// User taps "Connect Gmail" → app navigates here with their Supabase access token.
// We validate the token, build the Google OAuth URL with a signed state, and redirect.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const REDIRECT_URI = 'https://salus-staff.vercel.app/api/oauth-callback';

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(401).send('Missing auth token');
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google OAuth not configured on server');
  }

  // Validate the Supabase JWT — figure out who is connecting
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).send('Invalid or expired auth token');
  }

  // Build signed state — protects against CSRF and ties this OAuth flow to a specific user
  const stateSecret = process.env.SUPABASE_SERVICE_KEY; // any server-only secret works
  const stateData = {
    user_id: user.id,
    nonce: crypto.randomBytes(8).toString('hex'),
    ts: Date.now(),
  };
  const stateJson = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  const sig = crypto.createHmac('sha256', stateSecret).update(stateJson).digest('base64url');
  const state = `${stateJson}.${sig}`;

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',  // request a refresh_token so we can keep reading after access_token expires
    prompt: 'consent',       // force consent screen so refresh_token is always issued
    state,
  });

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
