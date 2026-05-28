const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const allowedOrigins = [
  'http://localhost:4200',
  'https://fundscut.web.app',
  'https://fundscut.firebaseapp.com'
];

let serviceAccount;
if (process.env.FIREBASE_CREDENTIALS) {
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
  serviceAccount = require('./firebase-key.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

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

// Helper to handle env prefix safely
const getCol = (req, name) => {
  const env = req.query.env || ''; 
  return db.collection(`${env}${name}`);
};

// ==========================================
// PUBLIC ROUTES
// ==========================================

app.get('/api/services', async (req, res) => {
  try {
    const snapshot = await getCol(req, 'services').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/times', async (req, res) => {
  try {
    // Schedule/Settings are usually global, but we prefix for total separation
    const docSnap = await getCol(req, 'settings').doc('schedule').get();
    res.json(docSnap.exists ? docSnap.data().availableTimes || [] : []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const docRef = await getCol(req, 'appointments').add(req.body);
    res.json({ id: docRef.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/bookings/date/:dateString', async (req, res) => {
  try {
    const snapshot = await getCol(req, 'appointments').where('dateString', '==', req.params.dateString).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/bookings/user/:email', async (req, res) => {
  try {
    const snapshot = await getCol(req, 'appointments').where('clientEmail', '==', req.params.email).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/bookings/:id/cancel', async (req, res) => {
  try {
    const id = req.params.id;
    const ref = getCol(req, 'appointments').doc(id);
    const snap = await ref.get();
    if (snap.exists) {
      const data = snap.data();
      await getCol(req, 'cancelled-appointments').doc(id).set({ ...data, status: 'cancelled', cancelledAt: new Date().toISOString() });
      await ref.delete();
      res.json({ success: true });
    } else { res.status(404).send("Not found"); }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

app.get('/api/admin/list', async (req, res) => {
  try {
    const type = req.query.type; // e.g. appointments, cancelled-appointments
    const snapshot = await getCol(req, type).get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/appointments/:id/complete', async (req, res) => {
  try {
    const id = req.params.id;
    const ref = getCol(req, 'appointments').doc(id);
    await getCol(req, 'past-appointments').doc(id).set({ ...req.body, status: 'completed' });
    await ref.delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/appointments/:id/noshow', async (req, res) => {
  try {
    const id = req.params.id;
    const ref = getCol(req, 'appointments').doc(id);
    await getCol(req, 'no-show-appointments').doc(id).set({ ...req.body, status: 'no-show' });
    await ref.delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// ADMIN MANAGEMENT ROUTES
// ==========================================

// 1. Fetch All Admins
app.get('/api/admin/users', async (req, res) => {
  try {
    const snapshot = await getCol(req, 'admins').get();
    res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. Add New Admin (Checks if user exists first)
app.post('/api/admin/users', async (req, res) => {
  try {
    const { email } = req.body;
    const env = req.query.env || '';
    
    // Check if user exists in the users collection
    const userQuery = await db.collection(`${env}users`)
      .where('email', '==', email.toLowerCase())
      .get();

    if (userQuery.empty) {
      return res.status(404).json({ error: "User not found" });
    }

    const docRef = await getCol(req, 'admins').add({
      email: email.toLowerCase(),
      addedAt: new Date().toISOString()
    });

    res.json({ id: docRef.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. Remove Admin
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await getCol(req, 'admins').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));