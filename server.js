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
            name TEXT NOT NULL,
            country TEXT NOT NULL,
            image TEXT NOT NULL,
            website TEXT NOT NULL,
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
        const isHuman = req.body.captcha === 'on'; // Checkbox value

        // Validate fields and CAPTCHA
        if (!name || !country || !website || !req.file || !isHuman) {
            return res.status(400).json({
                success: false,
                message: 'All fields (name, country, website, image, and CAPTCHA) are required.'
            });
        }

        // Resize and optimize image
        const optimizedImage = await sharp(req.file.buffer)
            .resize({ height: 300 })
            .jpeg({ quality: 80 })
            .toBuffer();

        const imageBase64 = `data:image/jpeg;base64,${optimizedImage.toString('base64')}`;

        // Insert record into database
        db.run(
            `INSERT INTO records (name, country, image, website) VALUES (?, ?, ?, ?)`,
            [name, country, imageBase64, website],
            function (err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ success: false, error: 'Database error' });
                }

                // Return success response
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

