// /api/register.js
// Vercel Serverless Function — handles the "Partner with us" join modal
// (both Employer and Worker registration forms).
// Saves the registration to Supabase. Optionally notifies you by email too.
//
// Required environment variables (same as /api/contact.js):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   NOTIFY_EMAIL — where notification emails get sent.
//     IMPORTANT: while using Resend's test sender (onboarding@resend.dev) with
//     no verified domain, this MUST be the exact email address your Resend
//     account was signed up with — Resend will silently fail to deliver to
//     any other address in sandbox mode.

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

let supabase = null;
let supabaseInitError = null;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
} catch (err) {
  supabaseInitError = err;
  console.error('Supabase client failed to initialize:', err);
}

let resend = null;
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  } else {
    console.error('RESEND_API_KEY is not set — email notifications will be skipped.');
  }
} catch (err) {
  console.error('Resend client failed to initialize (non-fatal):', err);
}

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    console.error('Aborting request: Supabase client not initialized.', supabaseInitError);
    return res.status(500).json({ error: 'Server is misconfigured (database connection). Please try again later.' });
  }

  try {
    const { kind, ...fields } = req.body || {};

    if (kind !== 'employer' && kind !== 'worker') {
      return res.status(400).json({ error: 'Invalid registration type.' });
    }

    const table = kind === 'employer' ? 'employer_signups' : 'worker_signups';

    const { error: dbError } = await supabase.from(table).insert([fields]);

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      return res.status(502).json({ error: 'Could not save your registration. Please try again.' });
    }

    // Best-effort notification — don't fail the request if this errors,
    // and skip entirely if Resend never initialized.
    if (resend && NOTIFY_EMAIL) {
      try {
        await resend.emails.send({
          from: 'BeyondX Website <onboarding@resend.dev>', // test sender — swap for your own verified domain later
          to: [NOTIFY_EMAIL],
          subject: `New ${kind} registration — BeyondX`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px;">
              <h2 style="color:#1A4731;">New ${kind} registration</h2>
              <pre style="background:#F3F3F3; padding:1rem; border-radius:8px; font-size:0.85rem;">${JSON.stringify(fields, null, 2)}</pre>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Resend notification failed (non-fatal):', emailErr);
      }
    } else {
      console.error('Skipped email notification: resend client or NOTIFY_EMAIL missing.');
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unexpected error in /api/register:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
