const express = require('express'); 
const cors = require('cors');       
// 1. IMPORT FIREBASE ADMIN
const admin = require('firebase-admin');

// 🔥 THE SECRET VAULT CHECK (LOAD YOUR SECRET GOD KEY)
let serviceAccount;
if (process.env.FIREBASE_CREDENTIALS) {
  // If running on Railway, it pulls the secret key from Railway's vault!
  serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
} else {
  // If running on your laptop, it just reads the local file.
  serviceAccount = require('./firebase-key.json');
}


// 3. INITIALIZE FIREBASE IN "GOD MODE"
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4. CREATE A VARIABLE TO TALK TO FIRESTORE
const db = admin.firestore();

const app = express(); 
app.use(cors()); 
app.use(express.json()); 

// ... keep your /api/test route and app.listen at the bottom! ...

// ==========================================
// 4. THE ROUTES (The Waiter's Menu)
// This is where Angular will send requests.
// ==========================================

// When Angular sends a GET request to 'http://localhost:3000/api/test', run this function!
app.get('/api/test', (req, res) => {
    
    // req = The Request (What Angular asked for)
    // res = The Response (What the Waiter sends back)

    console.log("Angular just knocked on the door!");

    // Send a JSON message back to Angular
    res.json({ message: "Hello from the Node.js Waiter! Your backend is working!" });
});

// ==========================================
// THE MENU ROUTE: Fetch all haircuts
// ==========================================
app.get('/api/services', async (req, res) => {
    try {
        // 1. Point to the 'services' folder in Firestore
        const servicesRef = db.collection('services');
        
        // 2. Grab all the documents
        const snapshot = await servicesRef.get();
        
        // 3. Loop through them and build a clean array
        const services = snapshot.docs.map(doc => {
            return {
                id: doc.id, // The Auto-ID
                ...doc.data() // Spreads out name, price, duration, etc.
            };
        });

        // 4. Send the clean array back to Angular!
        res.json(services);

    } catch (error) {
        console.error("Error fetching services:", error);
        // If it fails, send a 500 (Server Error) status back
        res.status(500).json({ error: "Failed to fetch services" });
    }
});

// ==========================================
// 1. Fetch Available Times
// ==========================================
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

// ==========================================
// 2. Fetch Bookings by Date (For Clash Math)
// ==========================================
// Notice the ":dateString" -> This lets Angular pass a specific date in the URL!
app.get('/api/bookings/date/:dateString', async (req, res) => {
    try {
        const dateString = req.params.dateString; // Grabs the date from the URL
        
        const appointmentsRef = db.collection('appointments');
        // God Mode query: "Give me all appointments matching this date"
        const snapshot = await appointmentsRef.where('dateString', '==', dateString).get();
        
        const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch date bookings" });
    }
});

// ==========================================
// 3. Save a New Booking (POST Request)
// ==========================================
// We use app.post() because Angular is SENDING data to us!
app.post('/api/bookings', async (req, res) => {
    try {
        const bookingData = req.body; // Grabs the JSON data Angular sent us

        const appointmentsRef = db.collection('appointments');
        const docRef = await appointmentsRef.add(bookingData); // Saves it!
        
        // Send back the generated Auto-ID so Angular can use it for the EmailJS link!
        res.json({ id: docRef.id, message: "Booking successful!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to save booking" });
    }
});

// ==========================================
// 4. Fetch Bookings for Logged-In User
// ==========================================
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

// ==========================================
// 5. Cancel a Booking (Move to Archive)
// ==========================================
// We use DELETE because we are removing it from the active database!
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

// ==========================================
// 6. Fetch ONE Booking by ID (For Cancel Page)
// ==========================================
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
// 5. START THE SERVER (Open the Restaurant)
// ==========================================
const PORT = process.env.PORT || 3000; 

app.listen(PORT, () => {
    console.log(`🚀 Node.js Waiter is alive on port ${PORT}`);
});