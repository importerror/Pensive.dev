/**
 * Backend API communication
 * Update API_BASE_URL to your deployed backend URL.
 */
var API_BASE_URL = 'https://pensivedev-production.up.railway.app';

function callBackendAPI(endpoint, payload) {
  try {
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    };
    var response = UrlFetchApp.fetch(API_BASE_URL + endpoint, options);
    var code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      return { error: 'API failed with status ' + code + '. Check that your Railway backend is running.' };
    }
  } catch (e) {
    return { error: 'Connection failed: ' + e.toString() };
  }
}
