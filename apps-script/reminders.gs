/**
 * Owner-managed Apps Script companion for Scht email reminders and updates.
 * It only receives prepared, scoped email jobs from Scht; it never receives OAuth credentials.
 */
function dispatchSchtReminders() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('SCHT_REMINDER_ENDPOINT');
  const token = properties.getProperty('SCHT_REMINDER_TOKEN');
  if (!endpoint || !token) throw new Error('Set SCHT_REMINDER_ENDPOINT and SCHT_REMINDER_TOKEN before scheduling this script.');

  const response = UrlFetchApp.fetch(endpoint, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() >= 300) throw new Error('Reminder fetch failed: ' + response.getContentText());

  (JSON.parse(response.getContentText()).jobs || []).forEach(function(job) {
    let success = false;
    let error = '';
    try {
      sendSchtEmail(job);
      success = true;
    } catch (exception) {
      error = String(exception);
      console.error('Scht email failed: ' + error);
    }
    const acknowledgement = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        reminderId: job.kind === 'daily_digest' ? undefined : job.id,
        idempotencyKey: job.idempotencyKey,
        success: success,
        error: error,
        kind: job.kind,
        digestUserId: job.digestUserId,
        digestDate: job.digestDate,
      }),
      muteHttpExceptions: true,
    });
    if (acknowledgement.getResponseCode() >= 300) console.log('Scht acknowledgement failed: ' + acknowledgement.getContentText());
  });
}

function sendSchtEmail(job) {
  MailApp.sendEmail({
    to: job.email,
    subject: emailSubject(job),
    body: buildPlainText(job),
    htmlBody: buildHtmlEmail(job),
    name: 'Scht',
  });
}

function emailSubject(job) {
  if (job.kind !== 'daily_digest') return 'Scht · Due soon: ' + job.title;
  return job.digest && job.digest.frequency === 'weekly'
    ? 'Scht · Your week ahead'
    : 'Scht · Your day, at a glance';
}

function buildHtmlEmail(job) {
  const digest = normaliseDigest(job.digest);
  const isUpdate = job.kind === 'daily_digest';
  const weekly = isUpdate && digest.frequency === 'weekly';
  const headline = isUpdate
    ? (weekly ? 'A calmer look at the week ahead.' : 'Your day, with fewer surprises.')
    : 'A gentle nudge for what matters next.';
  const eyebrow = isUpdate ? (weekly ? 'WEEKLY UPDATE' : 'DAILY UPDATE') : 'TASK REMINDER';
  const intro = isUpdate
    ? digestIntro(digest, weekly)
    : '“' + escapeHtml(job.title) + '” is due ' + escapeHtml(job.dueAt ? formatSchtDate(job.dueAt, digest.timezone) : 'soon') + '.';
  const focusCard = isUpdate ? buildSummaryCard(digest, weekly) : buildDeadlineCard(job, digest);
  const inbox = buildInboxCard(digest.gmailReviews);
  const button = buildButton(job.dashboardUrl, isUpdate ? (weekly ? 'Plan your week in Scht' : 'Open today in Scht') : 'Review this task in Scht');

  return '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>' +
    '@media screen and (max-width:620px){.scht-shell{width:100% !important}.scht-pad{padding-left:22px !important;padding-right:22px !important}.scht-stat{display:block !important;width:100% !important;padding:0 0 14px !important}.scht-stat:last-child{padding-bottom:0 !important}.scht-hero{font-size:28px !important}}' +
    '</style></head><body style="margin:0;padding:0;background:#f3f7f6;color:#16263a;font-family:Arial,Helvetica,sans-serif">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f7f6"><tr><td align="center" style="padding:30px 12px">' +
    '<table role="presentation" class="scht-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden">' +
    '<tr><td class="scht-pad" style="padding:27px 34px;background:#075e60;color:#ffffff">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="font-size:15px;font-weight:700;letter-spacing:.02em">Scht <span style="color:#bde9df;font-weight:400">· study with clarity</span></td><td align="right" style="font-size:11px;font-weight:700;letter-spacing:.12em;color:#d4f4eb">' + eyebrow + '</td></tr></table>' +
    '<h1 class="scht-hero" style="margin:25px 0 0;font-size:31px;line-height:1.16;letter-spacing:-.5px;color:#ffffff">' + headline + '</h1>' +
    '</td></tr>' +
    '<tr><td class="scht-pad" style="padding:32px 34px 12px">' +
    '<p style="margin:0;color:#3f5165;font-size:16px;line-height:1.65">' + intro + '</p>' +
    focusCard +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px"><tr><td style="padding-bottom:11px;border-bottom:1px solid #dce7e5"><p style="margin:0;color:#075e60;font-size:11px;font-weight:700;letter-spacing:.12em">COMING UP</p><h2 style="margin:6px 0 0;color:#16263a;font-size:21px;line-height:1.25">' + (isUpdate ? 'Protect these dates' : 'Your next scheduled items') + '</h2></td></tr></table>' +
    buildTimelineRows(digest) +
    inbox +
    button +
    '</td></tr>' +
    '<tr><td class="scht-pad" style="padding:24px 34px 28px"><div style="height:1px;background:#dce7e5;margin-bottom:18px"></div><p style="margin:0;color:#6a7c8c;font-size:12px;line-height:1.6">This update includes only information already imported into your Scht workspace. Adjust its timing or turn it off any time in Settings → Reminders.</p></td></tr>' +
    '</table></td></tr></table></body></html>';
}

function normaliseDigest(value) {
  const digest = value || {};
  const summary = digest.summary || {};
  return {
    days: Number(digest.days || 3),
    timezone: digest.timezone || Session.getScriptTimeZone(),
    frequency: digest.frequency === 'weekly' ? 'weekly' : 'daily',
    timeline: digest.timeline || [],
    gmailReviews: digest.gmailReviews || [],
    summary: {
      items: Number(summary.items || (digest.timeline || []).length),
      tasks: Number(summary.tasks || 0),
      events: Number(summary.events || 0),
    },
    rangeStart: digest.rangeStart || new Date().toISOString(),
    rangeEnd: digest.rangeEnd || new Date().toISOString(),
  };
}

function digestIntro(digest, weekly) {
  if (!digest.summary.items) return weekly
    ? 'Your next ' + digest.days + ' days are clear. Use the space for the work that needs your attention.'
    : 'Nothing is due or scheduled in the next ' + digest.days + ' day' + plural(digest.days) + '. A little breathing room is part of the plan.';
  const range = formatSchtDay(digest.rangeStart, digest.timezone) + '–' + formatSchtDay(digest.rangeEnd, digest.timezone);
  return weekly
    ? 'A focused outlook for ' + range + '. Keep the important dates visible before the week gets busy.'
    : 'A focused look at ' + range + '. Start with the next date that needs your attention.';
}

function buildSummaryCard(digest, weekly) {
  const label = weekly ? 'WEEK AHEAD' : 'YOUR OUTLOOK';
  const itemLabel = digest.summary.items === 1 ? 'date to protect' : 'dates to protect';
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:25px;background:#e7f3f0;border-radius:14px"><tr><td style="padding:18px 20px">' +
    '<p style="margin:0 0 15px;color:#075e60;font-size:11px;font-weight:700;letter-spacing:.11em">' + label + '</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>' +
    summaryStat(digest.summary.items, itemLabel) + summaryStat(digest.summary.tasks, digest.summary.tasks === 1 ? 'task or deadline' : 'tasks or deadlines') + summaryStat(digest.summary.events, digest.summary.events === 1 ? 'calendar event' : 'calendar events') +
    '</tr></table></td></tr></table>';
}

function summaryStat(number, label) {
  return '<td class="scht-stat" width="33.33%" valign="top" style="padding-right:10px"><p style="margin:0;color:#075e60;font-size:23px;line-height:1;font-weight:700">' + number + '</p><p style="margin:6px 0 0;color:#3f5165;font-size:12px;line-height:1.35">' + label + '</p></td>';
}

function buildDeadlineCard(job, digest) {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:25px;background:#fff5ed;border:1px solid #f3d7c2;border-radius:14px"><tr><td style="padding:18px 20px"><p style="margin:0;color:#a94712;font-size:11px;font-weight:700;letter-spacing:.11em">DUE DATE</p><p style="margin:7px 0 0;color:#16263a;font-size:18px;line-height:1.35;font-weight:700">' + escapeHtml(job.dueAt ? formatSchtDate(job.dueAt, digest.timezone) : 'Due soon') + '</p><p style="margin:7px 0 0;color:#5d4a40;font-size:13px;line-height:1.55">Set aside one small, specific next step before the deadline arrives.</p></td></tr></table>';
}

function buildTimelineRows(digest) {
  if (!digest.timeline.length) return '<p style="margin:18px 0 0;color:#526779;font-size:14px;line-height:1.6">No calendar events or due-dated tasks are scheduled in this outlook.</p>';
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:4px">' + digest.timeline.map(function(item, index) {
    const isLast = index === digest.timeline.length - 1;
    return '<tr><td valign="top" style="padding:17px 0 ' + (isLast ? '3' : '17') + 'px;border-bottom:' + (isLast ? '0' : '1px solid #edf1f0') + '"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top" style="width:10px;padding-top:6px"><div style="width:7px;height:7px;border-radius:7px;background:' + timelineColor(item.label) + '"></div></td><td style="padding-left:10px"><p style="margin:0;color:#16263a;font-size:15px;line-height:1.35;font-weight:700">' + escapeHtml(item.title) + '</p><p style="margin:5px 0 0;color:#5b6d7c;font-size:12px;line-height:1.5"><span style="color:#075e60;font-weight:700">' + escapeHtml(item.label) + '</span> · ' + escapeHtml(formatSchtDate(item.occursAt, digest.timezone)) + '</p></td></tr></table></td></tr>';
  }).join('') + '</table>';
}

function timelineColor(label) {
  if (label === 'Google Calendar') return '#3569a9';
  if (label === 'Canvas deadline') return '#b64a1a';
  if (label === 'Gmail follow-up') return '#87621a';
  return '#0b7774';
}

function buildInboxCard(subjects) {
  if (!subjects.length) return '';
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:25px;background:#f5f7fb;border-radius:14px"><tr><td style="padding:18px 20px"><p style="margin:0 0 9px;color:#405f95;font-size:11px;font-weight:700;letter-spacing:.11em">GMAIL TO REVIEW</p><p style="margin:0 0 8px;color:#3f5165;font-size:13px;line-height:1.55">These imported follow-ups may need a quick decision.</p><ul style="margin:0;padding-left:18px;color:#27394d;font-size:13px;line-height:1.7">' + subjects.map(function(subject) { return '<li>' + escapeHtml(subject) + '</li>'; }).join('') + '</ul></td></tr></table>';
}

function buildButton(url, label) {
  if (!url) return '';
  return '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px"><tr><td style="border-radius:10px;background:#075e60"><a href="' + escapeHtml(url) + '" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:14px;font-weight:700;line-height:1;text-decoration:none">' + escapeHtml(label) + ' →</a></td></tr></table>';
}

function buildPlainText(job) {
  const digest = normaliseDigest(job.digest);
  const isUpdate = job.kind === 'daily_digest';
  const weekly = isUpdate && digest.frequency === 'weekly';
  const lines = [
    isUpdate ? (weekly ? 'SCHT WEEKLY UPDATE' : 'SCHT DAILY UPDATE') : 'SCHT TASK REMINDER',
    '',
    isUpdate ? digestIntro(digest, weekly) : job.title + '\nDue: ' + (job.dueAt ? formatSchtDate(job.dueAt, digest.timezone) : 'soon'),
    '',
    'COMING UP',
  ];
  (digest.timeline || []).forEach(function(item) { lines.push('- ' + item.title + ' (' + item.label + ', ' + formatSchtDate(item.occursAt, digest.timezone) + ')'); });
  if (!digest.timeline.length) lines.push('- No calendar events or due-dated tasks are scheduled in this outlook.');
  if (digest.gmailReviews.length) {
    lines.push('', 'GMAIL TO REVIEW');
    digest.gmailReviews.forEach(function(subject) { lines.push('- ' + subject); });
  }
  if (job.dashboardUrl) lines.push('', 'Open Scht: ' + job.dashboardUrl);
  return lines.join('\n');
}

function formatSchtDate(value, timezone) { return Utilities.formatDate(new Date(value), timezone || Session.getScriptTimeZone(), 'EEE, MMM d · h:mm a'); }
function formatSchtDay(value, timezone) { return Utilities.formatDate(new Date(value), timezone || Session.getScriptTimeZone(), 'MMM d'); }
function plural(number) { return number === 1 ? '' : 's'; }
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
