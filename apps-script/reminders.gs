/** Deploy this as the owner-managed Apps Script companion. */
function dispatchSchtReminders() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('SCHT_REMINDER_ENDPOINT');
  const token = properties.getProperty('SCHT_REMINDER_TOKEN');
  if (!endpoint || !token) throw new Error('Set SCHT_REMINDER_ENDPOINT and SCHT_REMINDER_TOKEN before scheduling this script.');
  const response = UrlFetchApp.fetch(endpoint, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) throw new Error('Reminder fetch failed: ' + response.getContentText());
  const jobs = JSON.parse(response.getContentText()).jobs || [];
  jobs.forEach(function(job) {
    let success = false;
    let error = '';
    try {
      MailApp.sendEmail(job.email, 'Scht reminder: ' + job.title, 'Reminder for ' + job.title + (job.dueAt ? '\nDue: ' + job.dueAt : ''));
      success = true;
    } catch (exception) { error = String(exception); }
    UrlFetchApp.fetch(endpoint, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ reminderId: job.id, idempotencyKey: job.idempotencyKey, success: success, error: error }), muteHttpExceptions: true });
  });
}
