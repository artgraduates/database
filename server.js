const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();

// Allow only frontend-origin requests with CORS
app.use(cors({
    origin: 'https://artgraduates-frontend.onrender.com', // Replace with your frontend's Render URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Middleware to parse JSON requests and serve static files
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new sqlite3.Database(':memory:'); // Use a file DB for production

// Create table for records
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS records (
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

// Route: Form submission
app.post('/submit', upload.single('image'), async (req, res) => {
    try {
        const { name, country, website } = req.body;

        // Validate fields
        if (!name || !country || !website || !req.file) {
            return res.status(400).json({
                success: false,
                message: 'All fields (name, country, website, and image) are required.'
            });
        }

        // Resize and optimize image
        const optimizedImage = await sharp(req.file.buffer)
            .resize({ height: 300 }) // Resize height to 300px
            .jpeg({ quality: 80 }) // Optimize JPEG quality
            .toBuffer();

        const imageBase64 = `data:image/jpeg;base64,${optimizedImage.toString('base64')}`;

        // Insert record into database
        db.run(
            `INSERT INTO records (name, country, image, website) VALUES (?, ?, ?, ?)`,
            [name, country, imageBase64, website],
            function (err) {
                if (err) {
                    console.error('Error inserting record into database:', err.message);
                    return res.status(500).json({ success: false, error: 'Database error' });
                }

                // Send success response with the new record's ID
                res.status(200).json({ success: true, id: this.lastID });
            }
        );
    } catch (err) {
        console.error('Error in /submit route:', err.message);
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

