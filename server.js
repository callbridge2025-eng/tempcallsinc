// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const twilio = require('twilio');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper references from twilio package
const AccessToken = twilio && twilio.jwt && twilio.jwt.AccessToken;
const VoiceResponse = twilio && twilio.twiml && twilio.twiml.VoiceResponse;

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
    if (!AccessToken) {
      console.error('Twilio SDK: AccessToken not available at twilio.jwt.AccessToken');
      return res.status(500).json({ error: 'Server misconfiguration: Twilio SDK missing AccessToken' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    // ensure clientName isn't empty; fallback to random if it is
    const clientNameEnv = (process.env.CLIENT_NAME || '').trim();
    const clientName = clientNameEnv || ('browser-' + Math.random().toString(36).slice(2,8));

    // Validate required envs
    const missing = [];
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!apiKeySid) missing.push('TWILIO_API_KEY_SID');
    if (!apiKeySecret) missing.push('TWILIO_API_KEY_SECRET');
    if (missing.length) {
      console.error('Missing env vars for /token:', missing.join(', '));
      return res.status(500).json({ error: `Missing environment variables: ${missing.join(', ')}` });
    }

    // Locate VoiceGrant constructor (different twilio versions expose it differently)
    const Token = AccessToken;
    const VoiceGrant = Token.VoiceGrant || (twilio && twilio.jwt && twilio.jwt.AccessToken && twilio.jwt.AccessToken.VoiceGrant);

    if (!VoiceGrant) {
      console.error('Twilio SDK: VoiceGrant not found on AccessToken');
      return res.status(500).json({ error: 'Server misconfiguration: Twilio SDK missing VoiceGrant' });
    }

    // IMPORTANT: pass identity in constructor options (some twilio versions require this)
    const token = new Token(accountSid, apiKeySid, apiKeySecret, {
      ttl: 3600,
      identity: clientName
    });

    const voiceGrant = new VoiceGrant({ incomingAllow: true });
    token.addGrant(voiceGrant);

    // Return safe JSON (token is ephemeral JWT)
    return res.json({ identity: clientName, token: token.toJwt() });
  } catch (err) {
    console.error('Error creating token:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Internal server error', details: String(err && err.message) });
  }
});

// Twilio incoming webhook that routes PSTN calls to the browser client
app.post('/twilio/voice', (req, res) => {
  try {
    const clientNameEnv = (process.env.CLIENT_NAME || '').trim();
    const clientName = clientNameEnv || 'browser';
    const resp = new (twilio.twiml.VoiceResponse)();
    resp.dial().client(clientName);
    res.type('text/xml').send(resp.toString());
  } catch (err) {
    console.error('Error in /twilio/voice:', err && err.stack ? err.stack : err);
    res.type('text/xml').send('<Response></Response>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}.`);
});
