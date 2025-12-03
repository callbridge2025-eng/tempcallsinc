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
  /*
    Required env vars:
    TWILIO_ACCOUNT_SID
    TWILIO_API_KEY_SID
    TWILIO_API_KEY_SECRET
    TWILIO_TWIML_APP_SID (optional; we can set empty)
    CLIENT_NAME (optional)
  */
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const clientName = process.env.CLIENT_NAME || 'browser';

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    return res.status(500).json({ error: 'TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET must be set in .env' });
  }

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { ttl: 3600 });
  const voiceGrant = new VoiceGrant({
    // outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID, // not needed for receiving
    incomingAllow: true // allow incoming calls
  });
  token.addGrant(voiceGrant);
  token.identity = clientName;

  res.json({ identity: clientName, token: token.toJwt() });
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
