/** Owner-managed Apps Script companion for Scht reminders and daily timeline email. */
function dispatchSchtReminders() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('SCHT_REMINDER_ENDPOINT');
  const token = properties.getProperty('SCHT_REMINDER_TOKEN');
  if (!endpoint || !token) throw new Error('Set SCHT_REMINDER_ENDPOINT and SCHT_REMINDER_TOKEN before scheduling this script.');
  const response = UrlFetchApp.fetch(endpoint, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) throw new Error('Reminder fetch failed: ' + response.getContentText());
  (JSON.parse(response.getContentText()).jobs || []).forEach(function(job) {
    let success = false;
    let error = '';
    try { sendSchtEmail(job); success = true; } catch (exception) { error = String(exception); }
    const acknowledgement = UrlFetchApp.fetch(endpoint, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ reminderId: job.kind === 'daily_digest' ? undefined : job.id, idempotencyKey: job.idempotencyKey, success: success, error: error, kind: job.kind, digestUserId: job.digestUserId, digestDate: job.digestDate }), muteHttpExceptions: true });
    if (acknowledgement.getResponseCode() >= 300) console.log('Scht acknowledgement failed: ' + acknowledgement.getContentText());
  });
}

function sendSchtEmail(job) {
  const daily = job.kind === 'daily_digest';
  MailApp.sendEmail({ to: job.email, subject: daily ? 'Scht · your next ' + job.digest.days + ' days' : 'Scht · ' + job.title + ' is due soon', body: buildPlainText(job), htmlBody: buildHtmlEmail(job), name: 'Scht' });
}

function buildHtmlEmail(job) {
  const daily = job.kind === 'daily_digest';
  const digest = job.digest || { days: 3, timezone: Session.getScriptTimeZone(), timeline: [], gmailReviews: [] };
  const timelineRows = (digest.timeline || []).length ? digest.timeline.map(function(item) { return '<tr><td style="padding:14px 0;border-bottom:1px solid #e5e7eb"><p style="margin:0;color:#172233;font-size:15px;font-weight:700">' + escapeHtml(item.title) + '</p><p style="margin:4px 0 0;color:#52606d;font-size:13px">' + escapeHtml(item.label) + ' · ' + escapeHtml(formatSchtDate(item.occursAt, digest.timezone)) + '</p></td></tr>'; }).join('') : '<tr><td style="padding:14px 0;color:#52606d;font-size:14px">No calendar events or due-dated tasks are scheduled in this window.</td></tr>';
  const gmailRows = (digest.gmailReviews || []).length ? '<div style="margin-top:22px;padding:18px 20px;border-radius:14px;background:#f4f7f7"><p style="margin:0 0 8px;color:#075e60;font-size:12px;font-weight:700;letter-spacing:.08em">GMAIL TO REVIEW</p><ul style="margin:0;padding-left:19px;color:#334155;font-size:14px;line-height:1.7">' + digest.gmailReviews.map(function(subject) { return '<li>' + escapeHtml(subject) + '</li>'; }).join('') + '</ul></div>' : '';
  const lead = daily ? 'A quiet look at the next ' + digest.days + ' day' + (digest.days === 1 ? '' : 's') + ' in your workspace.' : escapeHtml(job.title) + ' is due ' + escapeHtml(job.dueAt ? formatSchtDate(job.dueAt, digest.timezone) : 'soon') + '.';
  const label = daily ? 'DAILY TIMELINE' : 'REMINDER';
  const headline = daily ? 'Start with the shape of your day.' : 'A gentle nudge for what matters next.';
  return '<!doctype html><html><body style="margin:0;background:#f4f7f7;font-family:Arial,sans-serif;color:#172233"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f7;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden"><tr><td style="padding:28px 30px;background:#075e60;color:#ffffff"><p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.12em">SCHT · STUDY WITH CLARITY</p><h1 style="margin:12px 0 0;font-size:27px;line-height:1.2">' + headline + '</h1></td></tr><tr><td style="padding:30px"><p style="margin:0;color:#075e60;font-size:12px;font-weight:700;letter-spacing:.09em">' + label + '</p><h2 style="margin:7px 0 8px;font-size:22px;line-height:1.3">' + (daily ? 'Your upcoming timeline' : escapeHtml(job.title)) + '</h2><p style="margin:0;color:#52606d;font-size:15px;line-height:1.6">' + lead + '</p><div style="height:1px;background:#e5e7eb;margin:28px 0"></div><p style="margin:0 0 5px;color:#075e60;font-size:12px;font-weight:700;letter-spacing:.09em">YOUR NEXT ' + digest.days + ' DAY' + (digest.days === 1 ? '' : 'S') + '</p><h3 style="margin:0 0 8px;font-size:19px">A timeline across your workspace</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0">' + timelineRows + '</table>' + gmailRows + '<p style="margin:28px 0 0;color:#64748b;font-size:12px;line-height:1.5">This email is sent by your school’s Scht Apps Script companion. It uses only the Calendar, Gmail, Canvas, and task data you connected to Scht.</p></td></tr></table></td></tr></table></body></html>';
}

function buildPlainText(job) {
  const daily = job.kind === 'daily_digest';
  const digest = job.digest || { days: 3, timezone: Session.getScriptTimeZone(), timeline: [], gmailReviews: [] };
  const lines = [daily ? 'SCHT DAILY TIMELINE' : 'SCHT REMINDER', '', daily ? 'Your next ' + digest.days + ' days' : job.title + '\nDue: ' + (job.dueAt ? formatSchtDate(job.dueAt, digest.timezone) : 'soon'), '', 'TIMELINE'];
  (digest.timeline || []).forEach(function(item) { lines.push('- ' + item.title + ' (' + item.label + ', ' + formatSchtDate(item.occursAt, digest.timezone) + ')'); });
  if (!(digest.timeline || []).length) lines.push('- No calendar events or due-dated tasks are scheduled in this window.');
  if ((digest.gmailReviews || []).length) { lines.push('', 'GMAIL TO REVIEW'); digest.gmailReviews.forEach(function(subject) { lines.push('- ' + subject); }); }
  return lines.join('\n');
}

function formatSchtDate(value, timezone) { return Utilities.formatDate(new Date(value), timezone || Session.getScriptTimeZone(), 'EEE, MMM d · h:mm a'); }
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
