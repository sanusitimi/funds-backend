const express = require('express'); 
const cors = require('cors');       
const admin = require('firebase-admin');

const allowedOrigins = [
  'http://localhost:4200',      
  'https://fundscut.web.app',   
  'https://fundscut.firebaseapp.com' 
];

// 🔥 THE BULLETPROOF SECRET VAULT CHECK
let serviceAccount;

if (process.env.FIREBASE_CREDENTIALS) {
  // RAILWAY MODE: Pulls from the digital vault and fixes broken newline characters!
  try {
    // This regex replaces escaped \\n strings with actual \n line breaks!
    const parsedKey = process.env.FIREBASE_CREDENTIALS.replace(/\\n/g, '\n');
    serviceAccount = JSON.parse(parsedKey);
  } catch (error) {
    console.error("CRITICAL ERROR: Failed to parse FIREBASE_CREDENTIALS in Railway.", error);
    process.exit(1); 
  }
} else {
  // LAPTOP MODE: Reads the local file.
  try {
    serviceAccount = require('./firebase-key.json');
  } catch (error) {
    console.warn("WARNING: firebase-key.json not found!");
  }
}

// 3. INITIALIZE FIREBASE IN "GOD MODE" (Only if we found a key!)
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const app = express(); 

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS security!')); 
    }
  }
}));

app.use(express.json());