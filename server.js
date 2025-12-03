// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { jwt: { AccessToken }, twiml: { VoiceResponse } } = require('twilio');

const VoiceGrant = AccessToken.VoiceGrant;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve homepage at /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate Access Token for the browser to accept calls
app.get('/token', (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const clientName = process.env.CLIENT_NAME || 'browser';

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      const missing = [
        !accountSid && 'TWILIO_ACCOUNT_SID',
        !apiKeySid && 'TWILIO_API_KEY_SID',
        !apiKeySecret && 'TWILIO_API_KEY_SECRET'
      ].filter(Boolean).join(', ');
      console.error('Missing env vars for /token:', missing);
      return res.status(500).json({ error: `Missing environment variables: ${missing}` });
    }

    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { ttl: 3600 });
    const voiceGrant = new VoiceGrant({ incomingAllow: true });
    token.addGrant(voiceGrant);
    token.identity = clientName;
    return res.json({ identity: clientName, token: token.toJwt() });
  } catch (err) {
    console.error('Error in /token:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error', details: String(err && err.message) });
  }
});

// Twilio webhook for incoming calls
app.post('/twilio/voice', (req, res) => {
  // Minimal TwiML: dial the browser client named CLIENT_NAME (default 'browser')
  const clientName = process.env.CLIENT_NAME || 'browser';
  const response = new VoiceResponse();
  // route incoming call to browser client
  response.dial().client(clientName);

  res.type('text/xml');
  res.send(response.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}. Open http://localhost:${PORT}`);
});
