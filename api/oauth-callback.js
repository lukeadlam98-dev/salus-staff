// /api/oauth-callback.js
// Google redirects here after the user grants permission.
// We validate the state (CSRF protection), exchange the code for tokens,
// look up the user's email address, store everything in Supabase,
// and redirect back to the app.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const REDIRECT_URI = 'https://salus-staff.vercel.app/api/oauth-callback';

export default async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  // User declined or Google errored out
  if (oauthError) {
    return res.redirect(302, `/?gmail=error&reason=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return res.redirect(302, '/?gmail=error&reason=missing_params');
  }

  // ─── Validate state (CSRF protection) ───
  const [stateJson, sig] = String(state).split('.');
  if (!stateJson || !sig) {
    return res.redirect(302, '/?gmail=error&reason=bad_state');
  }
  const stateSecret = process.env.SUPABASE_SERVICE_KEY;
  const expectedSig = crypto.createHmac('sha256', stateSecret).update(stateJson).digest('base64url');
  if (sig !== expectedSig) {
    return res.redirect(302, '/?gmail=error&reason=state_mismatch');
  }
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(stateJson, 'base64url').toString('utf-8'));
  } catch {
    return res.redirect(302, '/?gmail=error&reason=bad_state_json');
  }
  // State expires after 10 minutes — prevents replay
  if (Date.now() - stateData.ts > 10 * 60 * 1000) {
    return res.redirect(302, '/?gmail=error&reason=state_expired');
  }

  // ─── Exchange code for tokens ───
  let tokens;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Token exchange failed:', errText);
      return res.redirect(302, '/?gmail=error&reason=token_exchange');
    }
    tokens = await tokenRes.json();
    // tokens: { access_token, refresh_token, expires_in, scope, token_type }
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.redirect(302, '/?gmail=error&reason=fetch_failed');
  }

  // ─── Get user's email from Google ───
  let emailAddress = null;
  try {
    const meRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      emailAddress = me.email;
    }
  } catch (err) {
    console.warn('userinfo fetch failed (non-fatal):', err);
  }

  // ─── Store tokens in Supabase ───
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  const payload = {
    user_id: stateData.user_id,
    provider: 'gmail',
    access_token: tokens.access_token,
    token_expiry: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    email_address: emailAddress,
    scope: tokens.scope || null,
    connected_at: new Date().toISOString(),
  };
  // Only set refresh_token if Google returned one (some flows don't)
  if (tokens.refresh_token) payload.refresh_token = tokens.refresh_token;

  const { error: dbError } = await supabase
    .from('email_integrations')
    .upsert(payload, { onConflict: 'user_id,provider' });

  if (dbError) {
    console.error('DB upsert failed:', dbError);
    return res.redirect(302, '/?gmail=error&reason=db_save');
  }

  // ─── Success → back to app ───
  return res.redirect(302, '/?gmail=connected');
}
