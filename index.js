const express = require('express'); 
const cors = require('cors');       
const admin = require('firebase-admin');

const allowedOrigins = [
  'http://localhost:4200',      // Allows your laptop to test
  'https://fundscut.web.app',   // Allows your live website
  'https://fundscut.firebaseapp.com' // Firebase's backup URL
];

// 🔥 THE BULLETPROOF SECRET VAULT CHECK
let serviceAccount;

if (process.env.FIREBASE_CREDENTIALS) {
  // RAILWAY MODE: Pulls from the digital vault and fixes broken newline characters!
  try {
    const parsedKey = process.env.FIREBASE_CREDENTIALS.replace(/\\n/g, '\n');
    serviceAccount = JSON.parse(parsedKey);
  } catch (error) {
    console.error("CRITICAL ERROR: Failed to parse FIREBASE_CREDENTIALS in Railway.", error);
    process.exit(1); // Kill the server if the vault is broken
  }
} else {
  // LAPTOP MODE: Fails gracefully if the file is missing
  try {
    serviceAccount = require('./firebase-key.json');
  } catch (error) {
    console.warn("WARNING: firebase-key.json not found! (This is normal on Railway).");
  }
}

// 3. INITIALIZE FIREBASE IN "GOD MODE" (Only if we found a key!)
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// 4. CREATE A VARIABLE TO TALK TO FIRESTORE
const db = admin.firestore();

const app = express(); 

app.use(cors({
  origin: function (origin, callback) {
    // If the request comes from an allowed origin (or is internal), let it in!
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS security!')); // Blocks hackers!
    }
  }
}));

app.use(express.json()); 

// ==========================================
// THE ROUTES (The Waiter's Menu)
// ==========================================

// 🔥 Railway Health Check Route
app.get('/', (req, res) => {
    res.send("🚀 FundsCut Backend is Live!");
});

// Test Route
app.get('/api/test', (req, res) => {
    console.log("Angular just knocked on the door!");
    res.json({ message: "Hello from the Node.js Waiter! Your backend is working!" });
});

// Fetch all haircuts
app.get('/api/services', async (req, res) => {
    try {
        const servicesRef = db.collection('services');
        const snapshot = await servicesRef.get();
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch services" });
    }
});

// Fetch Available Times
app.get('/api/times', async (req, res) => {
    try {
        const scheduleRef = db.collection('settings').doc('schedule');
        const docSnap = await scheduleRef.get();
        
        if (docSnap.exists) {
            res.json(docSnap.data().availableTimes || []);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch times" });
    }
});

// Fetch Bookings by Date (For Clash Math)
app.get('/api/bookings/date/:dateString', async (req, res) => {
    try {
        const dateString = req.params.dateString; 
        const appointmentsRef = db.collection('appointments');
        const snapshot = await appointmentsRef.where('dateString', '==', dateString).get();
        
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch date bookings" });
    }
});

// Save a New Booking (POST Request)
app.post('/api/bookings', async (req, res) => {
    try {
        const bookingData = req.body; 
        const appointmentsRef = db.collection('appointments');
        const docRef = await appointmentsRef.add(bookingData); 
        
        res.json({ id: docRef.id, message: "Booking successful!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save booking" });
    }
});

// Fetch Bookings for Logged-In User
app.get('/api/bookings/user/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const appointmentsRef = db.collection('appointments');
        const snapshot = await appointmentsRef.where('clientEmail', '==', email).get();
        
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user bookings" });
    }
});

// Cancel a Booking (Move to Archive)
app.delete('/api/bookings/:id/cancel', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const originalDocRef = db.collection('appointments').doc(bookingId);
        const originalSnap = await originalDocRef.get();

        if (originalSnap.exists) {
            const bookingData = originalSnap.data();
            bookingData.status = 'cancelled';
            bookingData.cancelledAt = new Date().toISOString();

            // Copy to archive, then delete original
            await db.collection('cancelled-appointments').doc(bookingId).set(bookingData);
            await originalDocRef.delete();
            
            res.json({ message: "Booking successfully cancelled and archived." });
        } else {
            res.status(404).json({ error: "Booking not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to cancel booking" });
    }
});

// Fetch ONE Booking by ID (For Cancel Page)
app.get('/api/bookings/:id', async (req, res) => {
    try {
        const bookingId = req.params.id;
        const docRef = db.collection('appointments').doc(bookingId);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            res.json({ id: docSnap.id, ...docSnap.data() });
        } else {
            res.status(404).json({ error: "Booking not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch booking details" });
    }
});

// ==========================================
// 5. START THE SERVER 
// ==========================================
const PORT = process.env.PORT || 3000; 

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Node.js Waiter is alive on port ${PORT}`);
});