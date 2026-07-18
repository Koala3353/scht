/** Deploy this as the owner-managed Apps Script companion. */
function dispatchSchtReminders() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('SCHT_REMINDER_ENDPOINT');
  const token = properties.getProperty('SCHT_REMINDER_TOKEN');
  if (!endpoint || !token) throw new Error('Set SCHT_REMINDER_ENDPOINT and SCHT_REMINDER_TOKEN before scheduling this script.');
  const response = UrlFetchApp.fetch(endpoint, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ runAt: new Date().toISOString() }), muteHttpExceptions: true });
  if (response.getResponseCode() >= 300) throw new Error('Reminder dispatch failed: ' + response.getContentText());
}
