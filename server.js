const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS
app.use(cors({
    origin: 'https://artgraduates-frontend.onrender.com', // Frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize SQLite Database (file-based for permanent storage)
const db = new sqlite3.Database(path.join(__dirname, 'artgraduates.db'));

// Create the `records` table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            country TEXT NOT NULL,
            image TEXT NOT NULL,
            personal_image TEXT,
            website TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// Configure Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Route: Form submission
app.post('/submit', upload.fields([{ name: 'image' }, { name: 'personalImage' }]), async (req, res) => {
    try {
        const { name, country, website, description } = req.body;
        const isHuman = req.body.captcha === 'on';

        // Validate fields
        if (!name || !country || !website || !req.files['image'] || !isHuman) {
            return res.status(400).json({
                success: false,
                message: 'All fields (name, country, website, artwork image, and CAPTCHA) are required.'
            });
        }

        // Process artwork image
        const optimizedArtworkImage = await sharp(req.files['image'][0].buffer)
            .resize({ height: 900 }) // Increased size for better visibility
            .jpeg({ quality: 80 })
            .toBuffer();
        const artworkImageBase64 = `data:image/jpeg;base64,${optimizedArtworkImage.toString('base64')}`;

        // Process personal image if uploaded
        let personalImageBase64 = null;
        if (req.files['personalImage']) {
            const optimizedPersonalImage = await sharp(req.files['personalImage'][0].buffer)
                .resize({ height: 900 })
                .jpeg({ quality: 80 })
                .toBuffer();
            personalImageBase64 = `data:image/jpeg;base64,${optimizedPersonalImage.toString('base64')}`;
        }

        // Insert record into the database
        db.run(
            `INSERT INTO records (name, country, image, personal_image, website, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, country, artworkImageBase64, personalImageBase64, website, description],
            function (err) {
                if (err) {
                    console.error('Database error:', err.message);
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                res.status(200).json({ success: true, id: this.lastID });
            }
        );
    } catch (err) {
        console.error('Error in /submit route:', err.message);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Route: Fetch records with sorting and filtering
app.get('/records', (req, res) => {
    const { sort = 'newest', country = '' } = req.query;
    let query = `SELECT * FROM records`;
    let params = [];

    if (country) {
        query += ` WHERE country = ?`;
        params.push(country);
    }

    switch (sort) {
        case 'oldest':
            query += ` ORDER BY created_at ASC`;
            break;
        case 'az':
            query += ` ORDER BY SUBSTR(name, INSTR(name, ' ') + 1) ASC`;
            break;
        case 'za':
            query += ` ORDER BY SUBSTR(name, INSTR(name, ' ') + 1) DESC`;
            break;
        case 'newest':
        default:
            query += ` ORDER BY created_at DESC`;
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching records:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.status(200).json(rows);
    });
});

// Route: Fetch list of unique countries
app.get('/countries', (req, res) => {
    db.all(`SELECT DISTINCT country FROM records`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching countries:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        const countries = rows.map(row => row.country);
        res.status(200).json(countries);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

