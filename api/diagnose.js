// /api/diagnose.js
// TEMPORARY diagnostic endpoint — visit this URL directly in your browser
// (e.g. https://beyondx-landingpage.vercel.app/api/diagnose) to see exactly
// which environment variables are missing or malformed, without exposing
// any actual secret values.
//
// DELETE THIS FILE once the database issue is fixed — it's not meant to
// stay in production long-term, even though it doesn't leak secrets.

module.exports = async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL;

  const report = {
    SUPABASE_URL: {
      present: !!url,
      looksValid: !!url && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url.trim()),
      length: url ? url.length : 0,
      startsWithHttps: !!url && url.trim().startsWith('https://'),
      hasTrailingSlash: !!url && url.endsWith('/'),
      hasWhitespace: !!url && url !== url.trim(),
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      present: !!serviceKey,
      length: serviceKey ? serviceKey.length : 0,
      looksLikeJWT: !!serviceKey && serviceKey.split('.').length === 3,
      hasWhitespace: !!serviceKey && serviceKey !== serviceKey.trim(),
    },
    RESEND_API_KEY: {
      present: !!resendKey,
      startsWithRe: !!resendKey && resendKey.startsWith('re_'),
    },
    NOTIFY_EMAIL: {
      present: !!notifyEmail,
      value: notifyEmail || null, // not secret, safe to show
    },
  };

  // Actually attempt to create the Supabase client and report the real error.
  let clientError = null;
  try {
    const { createClient } = require('@supabase/supabase-js');
    if (!url || !serviceKey) {
      throw new Error('Cannot attempt client creation: URL or key missing.');
    }
    createClient(url, serviceKey);
  } catch (err) {
    clientError = err.message;
  }

  // Actually attempt a real connection to Supabase (a harmless query).
  let connectionTest = null;
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(url, serviceKey);
    const { error } = await supabase.from('contact_leads').select('id').limit(1);
    connectionTest = error ? { success: false, error: error.message, code: error.code } : { success: true };
  } catch (err) {
    connectionTest = { success: false, error: err.message };
  }

  // Actually attempt a real Resend send and report the exact error.
  let resendTest = null;
  try {
    const { Resend } = require('resend');
    if (!resendKey) {
      throw new Error('RESEND_API_KEY not set, skipping send test.');
    }
    if (!notifyEmail) {
      throw new Error('NOTIFY_EMAIL not set, skipping send test.');
    }
    const resendClient = new Resend(resendKey);
    const result = await resendClient.emails.send({
      from: 'BeyondX Website <onboarding@resend.dev>',
      to: [notifyEmail],
      subject: 'BeyondX diagnostic test email',
      html: '<p>This is a test email from the /api/diagnose endpoint to confirm Resend delivery works.</p>',
    });
    resendTest = { success: !result.error, data: result.data || null, error: result.error || null };
  } catch (err) {
    resendTest = { success: false, error: err.message };
  }

  return res.status(200).json({ report, clientError, connectionTest, resendTest });
};
