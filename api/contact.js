// /api/contact.js
// Vercel Serverless Function — handles "Get in touch" form submissions,
// including the mandatory worker/employer onboarding questions step.
// Saves the lead to Supabase, then emails a notification via Resend to
// the address set in NOTIFY_EMAIL.
//
// Required environment variables (set in Vercel Project Settings → Environment Variables):
//   SUPABASE_URL              — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (server-side only, never expose to the browser)
//   RESEND_API_KEY            — your Resend API key
//   NOTIFY_EMAIL              — where notification emails get sent. Once beyondxco.com
//     is verified in Resend, you can list multiple recipients here separated by
//     commas, e.g. "person1@beyondxco.com,person2@gmail.com" — no code change needed.

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

let supabase = null;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
} catch (err) {
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

const NOTIFY_EMAILS = (process.env.NOTIFY_EMAIL || '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);
if (NOTIFY_EMAILS.length === 0) {
  console.error('NOTIFY_EMAIL environment variable is not set. Set it in Vercel → Settings → Environment Variables.');
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Server is misconfigured (database connection). Please try again later.' });
  }

  try {
    const { name, email, message, category } = req.body || {};
    const safeCategory = (typeof category === 'string' && category.trim()) ? category.trim() : 'get_in_touch';

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please include a message.' });
    }

    // 1. Save the lead to Supabase so nothing is lost even if the email fails.
    const { error: dbError } = await supabase
      .from('contact_leads')
      .insert([{ name: name || null, email, message, source: safeCategory }]);

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      // Continue to try sending the email even if the DB write fails —
      // we'd rather you get notified than lose the lead entirely.
    }

    // 2. Send the notification email, if Resend is configured.
    if (resend && NOTIFY_EMAILS.length > 0) {
      const safeName = (name || 'Someone').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const categoryLabels = {
        get_in_touch: 'New "Get in touch" request',
        worker_onboarding: '👋 New Worker Onboarding',
        employer_onboarding: '👋 New Employer Onboarding'
      };
      const subjectLine = `${categoryLabels[safeCategory] || 'New contact request'} — BeyondX`;
      const { error: emailError } = await resend.emails.send({
        from: 'BeyondX <notifications@beyondxco.com>', // requires beyondxco.com verified in Resend — see setup note above
        to: NOTIFY_EMAILS,
        reply_to: email,
        subject: subjectLine,
        html: `
          <div style="font-family: sans-serif; max-width: 480px;">
            <h2 style="color:#1A4731;">${subjectLine}</h2>
            <p>Submitted via the "Get in touch" form on the BeyondX landing page.</p>
            <p style="font-size:1.1rem;"><strong>Name:</strong> ${safeName}</p>
            <p style="font-size:1.1rem;"><strong>Email:</strong> ${email}</p>
            <p style="font-size:1rem; white-space:pre-wrap;"><strong>Message:</strong><br>${safeMessage}</p>
            <p style="color:#6B7280; font-size:0.85rem;">Reply directly to this email to respond to them.</p>
          </div>
        `,
      });

      if (emailError) {
        console.error('Resend send error:', emailError);
        return res.status(502).json({ error: 'Saved your request, but the notification email failed to send.' });
      }
    } else {
      console.error('Skipped email notification: resend client not configured or no valid NOTIFY_EMAIL recipients.');
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Unexpected error in /api/contact:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};

