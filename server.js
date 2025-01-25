const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();

// Enable CORS for the frontend domain
app.use(cors({
    origin: 'https://artgraduates-frontend.onrender.com', // Replace with your frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Middleware for JSON parsing and serving static files
app.use(express.json()); // For parsing JSON in requests
app.use(express.static('public')); // Serve static files if needed

// Initialize SQLite Database
const db = new sqlite3.Database(':memory:'); // Use a file-based DB for production

// Create the `records` table
db.serialize(() => {
    db.run(`
        CREATE TABLE records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            country TEXT,
            image TEXT,
            website TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// Configure Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Routes

// Route: Form submission
app.post('/submit', upload.single('image'), async (req, res) => {
    try {
        const { name, country, website } = req.body;

        // Validate required fields
        if (!name || !country || !website || !req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields (name, country, website, and image) are required.' 
            });
        }

        // Resize the uploaded image using Sharp
        const optimizedImage = await sharp(req.file.buffer)
            .resize({ height: 300 }) // Resize to height of 300px
            .jpeg({ quality: 80 }) // Optimize JPEG quality
            .toBuffer();

        // Convert the optimized image to Base64
        const imageBase64 = `data:image/jpeg;base64,${optimizedImage.toString('base64')}`;

        // Insert the form data into the database
        db.run(
            `INSERT INTO records (name, country, image, website) VALUES (?, ?, ?, ?)`,
            [name, country, imageBase64, website],
            function (err) {
                if (err) {
                    console.error('Error inserting record into the database:', err.message);
                    return res.status(500).json({ success: false, error: 'Database error' });
                }

                // Return success response with the new record's ID
                res.status(200).json({ success: true, id: this.lastID });
            }
        );
    } catch (err) {
        console.error('Error processing form submission:', err.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Route: Fetch all records
app.get('/records', (req, res) => {
    db.all(`SELECT * FROM records ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching records:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        // Return all records as JSON
        res.status(200).json(rows);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
