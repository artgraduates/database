const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();

// Allow all origins with CORS
app.use(cors());

// Middleware
app.use(express.json()); // For parsing JSON
app.use(express.static('public')); // Serve static files

// Initialize SQLite Database
const db = new sqlite3.Database(':memory:'); // Use file DB for production

// Create table for records
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

// Multer for handling file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Routes

// Form submission route
app.post('/submit', upload.single('image'), async (req, res) => {
    try {
        const { name, country, website } = req.body;

        if (!name || !country || !website || !req.file) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Resize image using sharp
        const optimizedImage = await sharp(req.file.buffer)
            .resize({ height: 300 })
            .jpeg({ quality: 80 })
            .toBuffer();

        const imageBase64 = `data:image/jpeg;base64,${optimizedImage.toString('base64')}`;

        // Insert record into the database
        db.run(
            `INSERT INTO records (name, country, image, website) VALUES (?, ?, ?, ?)`,
            [name, country, imageBase64, website],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, id: this.lastID });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Fetch records route
app.get('/records', (req, res) => {
    db.all(`SELECT * FROM records ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json(rows);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
