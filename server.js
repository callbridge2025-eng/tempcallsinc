// server.js (verbose, safe)
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const twilio = require('twilio');

const AccessToken = twilio.jwt && twilio.jwt.AccessToken;
const VoiceResponse = twilio.twiml && twilio.twiml.VoiceResponse;
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Basic sanity log on startup (DOES NOT print secrets)
const checkEnv = () => {
  const checks = {
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID: !!process.env.TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET: !!process.env.TWILIO_API_KEY_SECRET,
    CLIENT_NAME: !!process.env.CLIENT_NAME
  };
  console.log('Env presence:', checks);
};
checkEnv();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/token', (req, res) => {
  try {
    // Validate AccessToken helper exists
    if (!AccessToken) {
      console.error('Twilio SDK: AccessToken not found on twilio.jwt.AccessToken');
      return res.status(500).json({ error: 'Server misconfiguration: Twilio SDK missing AccessToken' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const clientName = process.env.CLIENT_NAME || 'browser';

    // Check env presence with helpful message
    const missing = [];
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!apiKeySid) missing.push('TWILIO_API_KEY_SID');
    if (!apiKeySecret) missing.push('TWILIO_API_KEY_SECRET');

    if (missing.length) {
      console.error('Missing env vars for /token:', missing.join(', '));
      return res.status(500).json({ error: `Missing environment variables: ${missing.join(', ')}` });
    }

    // Create token & grant
    const Token = AccessToken;
    const VoiceGrant = Token.VoiceGrant || (twilio.jwt && twilio.jwt.AccessToken && twilio.jwt.AccessToken.VoiceGrant);
    if (!VoiceGrant) {
      console.error('Twilio SDK: VoiceGrant not found on AccessToken');
      return res.status(500).json({ error: 'Server misconfiguration: Twilio SDK missing VoiceGrant' });
    }

    const token = new Token(accountSid, apiKeySid, apiKeySecret, { ttl: 3600 });
    const voiceGrant = new VoiceGrant({ incomingAllow: true });
    token.addGrant(voiceGrant);
    token.identity = clientName;

    return res.json({ identity: clientName, token: token.toJwt() });
  } catch (err) {
    // Log stack trace server-side (safe). Do NOT print secrets.
    console.error('Error creating token:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error', details: String(err && err.message) });
  }
});

// Twilio incoming webhook (unchanged)
app.post('/twilio/voice', (req, res) => {
  try {
    const clientName = process.env.CLIENT_NAME || 'browser';
    const response = new (twilio.twiml.VoiceResponse)();
    response.dial().client(clientName);
    res.type('text/xml').send(response.toString());
  } catch (err) {
    console.error('Error in /twilio/voice:', err && err.stack ? err.stack : err);
    res.type('text/xml').send('<Response></Response>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}.`);
});
