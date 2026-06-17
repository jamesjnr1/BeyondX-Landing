// /api/register.js
// Vercel Serverless Function — handles the "Partner with us" join modal
// (both Employer and Worker registration forms).
// Saves the registration to Supabase. Optionally notifies you by email too.
//
// Required environment variables (same as /api/contact.js):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   NOTIFY_EMAIL (optional, defaults to beyondx26@gmail.com)

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'beyondx26@gmail.com';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
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

    // Best-effort notification — don't fail the request if this errors.
    try {
      await resend.emails.send({
        from: 'BeyondX Website <onboarding@resend.dev>', // replace with your verified Resend domain
        to: beyondx26@gmail.com,
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

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unexpected error in /api/register:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
