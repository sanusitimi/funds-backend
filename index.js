const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// 1. Allowed Websites
const allowedOrigins = [
  'http://localhost:4200',
  'https://fundscut.web.app',
  'https://fundscut.firebaseapp.com'
];

// 2. Load Firebase Key
let serviceAccount;
if (process.env.FIREBASE_CREDENTIALS) {
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
  serviceAccount = require('./firebase-key.json');
}

// 3. Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// 4. Middleware (Secure CORS)
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// 5. Routes
app.get('/', (req, res) => res.send("Backend is running."));

app.get('/api/services', async (req, res) => {
  try {
    const snapshot = await db.collection('services').get();
    const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

app.get('/api/times', async (req, res) => {
  try {
    const docSnap = await db.collection('settings').doc('schedule').get();
    res.json(docSnap.exists ? docSnap.data().availableTimes || [] : []);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch times" });
  }
});

app.get('/api/bookings/date/:dateString', async (req, res) => {
  try {
    const snapshot = await db.collection('appointments').where('dateString', '==', req.params.dateString).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch date bookings" });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const docRef = await db.collection('appointments').add(req.body);
    res.json({ id: docRef.id, message: "Booking successful!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save booking" });
  }
});

app.get('/api/bookings/user/:email', async (req, res) => {
  try {
    const snapshot = await db.collection('appointments').where('clientEmail', '==', req.params.email).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user bookings" });
  }
});

app.delete('/api/bookings/:id/cancel', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const originalDocRef = db.collection('appointments').doc(bookingId);
    const originalSnap = await originalDocRef.get();

    if (originalSnap.exists) {
      const bookingData = originalSnap.data();
      bookingData.status = 'cancelled';
      bookingData.cancelledAt = new Date().toISOString();

      await db.collection('cancelled-appointments').doc(bookingId).set(bookingData);
      await originalDocRef.delete();
      res.json({ message: "Cancelled and archived." });
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel" });
  }
});

app.get('/api/bookings/:id', async (req, res) => {
  try {
    const docSnap = await db.collection('appointments').doc(req.params.id).get();
    if (docSnap.exists) {
      res.json({ id: docSnap.id, ...docSnap.data() });
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// 6. Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});