const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server/server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Replace all occurrences
content = content.replace(/transporter\.sendMail/g, 'sendEmailViaGAS');

fs.writeFileSync(serverPath, content);
console.log('Successfully replaced all transporter.sendMail with sendEmailViaGAS.');
