// Beta Signup Daily Digest
// Queries Firestore for signups & feedback from the last 24 hours,
// then emails a digest via Resend. Exits silently if nothing new.

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const resend = new Resend(process.env.RESEND_API_KEY);
const toEmail = process.env.DIGEST_TO_EMAIL || 'jeremiah@uncs.com';

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// WHY: 24h window matches cron schedule — no gaps, no overlaps
const cutoff = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

async function getNewSignups() {
  const snap = await db.collection('beta_signups')
    .where('signedUpAt', '>=', cutoff)
    .orderBy('signedUpAt', 'desc')
    .get();
  return snap.docs.map(d => d.data());
}

async function getNewFeedback() {
  const snap = await db.collection('beta_feedback')
    .where('submittedAt', '>=', cutoff)
    .orderBy('submittedAt', 'desc')
    .get();
  return snap.docs.map(d => d.data());
}

function formatSignup(s) {
  const apps = (s.apps || []).join(', ');
  const device = s.device || 'unknown';
  return `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee">${s.name || '—'}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${s.email || '—'}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${apps}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${device}</td>
  </tr>`;
}

function formatFeedback(f) {
  return `<tr>
    <td style="padding:8px;border-bottom:1px solid #eee">${f.app || '—'}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${f.type || '—'}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${f.title || '—'}</td>
    <td style="padding:8px;border-bottom:1px solid #eee">${f.email || '—'}</td>
  </tr>`;
}

const [signups, feedback] = await Promise.all([getNewSignups(), getNewFeedback()]);

if (signups.length === 0 && feedback.length === 0) {
  console.log('No new signups or feedback in the last 24 hours. Skipping digest.');
  process.exit(0);
}

let html = `<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto">
<h2 style="color:#1a1a2e">Beta Daily Digest</h2>
<p style="color:#666">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`;

if (signups.length > 0) {
  html += `<h3 style="margin-top:24px">${signups.length} New Signup${signups.length > 1 ? 's' : ''}</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr style="background:#f5f5f5;text-align:left">
      <th style="padding:8px">Name</th>
      <th style="padding:8px">Email</th>
      <th style="padding:8px">Apps</th>
      <th style="padding:8px">Device</th>
    </tr>
    ${signups.map(formatSignup).join('')}
  </table>`;
}

if (feedback.length > 0) {
  html += `<h3 style="margin-top:24px">${feedback.length} New Feedback</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr style="background:#f5f5f5;text-align:left">
      <th style="padding:8px">App</th>
      <th style="padding:8px">Type</th>
      <th style="padding:8px">Title</th>
      <th style="padding:8px">From</th>
    </tr>
    ${feedback.map(formatFeedback).join('')}
  </table>`;
}

html += `<p style="margin-top:24px;color:#999;font-size:12px">
  <a href="https://jeremiahgutierrez.com/beta-admin.html" style="color:#4a90d9">View full admin panel</a>
</p></div>`;

const { error } = await resend.emails.send({
  from: 'Beta Digest <digest@jeremiahgutierrez.com>',
  to: toEmail,
  subject: `Beta Digest: ${signups.length} signup${signups.length !== 1 ? 's' : ''}, ${feedback.length} feedback`,
  html,
});

if (error) {
  console.error('Failed to send digest:', error);
  process.exit(1);
}

console.log(`Digest sent: ${signups.length} signups, ${feedback.length} feedback`);
