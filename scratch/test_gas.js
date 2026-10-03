require('dotenv').config({ path: '../server/.env' });

async function sendEmailViaGAS({ to, subject, html, text }) {
  const scriptUrl = process.env.EMAIL_SCRIPT_URL;
  if (!scriptUrl) {
    throw new Error('EMAIL_SCRIPT_URL environment variable is not defined.');
  }

  const payload = {
    to: to,
    subject: subject,
    htmlBody: html || '',
    textBody: text || ''
  };

  console.log("Sending payload to:", scriptUrl);

  const res = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Google Apps Script handles text/plain best for POST bodies
    body: JSON.stringify(payload)
  });

  const textRes = await res.text();
  console.log("Raw Response:", textRes);
  
  try {
    const result = JSON.parse(textRes);
    if (result.status !== 'success') {
      throw new Error(result.message || 'Google Apps Script returned an error.');
    }
    return result;
  } catch(e) {
    throw new Error("Failed to parse JSON: " + textRes);
  }
}

sendEmailViaGAS({
  to: process.env.SMTP_USER, // send to themselves to test
  subject: 'Test Email GAS',
  html: '<h1>Test</h1>'
}).then(() => console.log('Success!'))
  .catch(err => console.error('Error:', err.message));
