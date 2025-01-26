const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();

// Enable CORS
app.use(cors({
    origin: 'https://artgraduates-frontend.onrender.com',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Initialize SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'artgraduates.db'));

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

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Debugging Middleware
app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

app.post('/submit', upload.fields([{ name: 'image' }, { name: 'personalImage' }]), async (req, res) => {
    try {
        const { name, country, website, description, captcha } = req.body;

        // Check if all required fields are present
        if (!captcha || !name || !country || !website || !req.files['image']) {
            console.error('Missing required fields:', { name, country, website, captcha, image: req.files['image'] });
            return res.status(400).json({ success: false, message: 'All required fields must be filled out!' });
        }

        // Process artwork image
        let artworkImageBase64;
        try {
            const artworkImage = await sharp(req.files['image'][0].buffer)
                .resize({ height: 900 })
                .jpeg({ quality: 80 })
                .toBuffer();
            artworkImageBase64 = `data:image/jpeg;base64,${artworkImage.toString('base64')}`;
        } catch (err) {
            console.error('Error processing artwork image:', err);
            return res.status(500).json({ success: false, message: 'Error processing artwork image.' });
        }

        // Process personal image (if provided)
        let personalImageBase64 = null;
        if (req.files['personalImage']) {
            try {
                const personalImage = await sharp(req.files['personalImage'][0].buffer)
                    .resize({ height: 900 })
                    .jpeg({ quality: 80 })
                    .toBuffer();
                personalImageBase64 = `data:image/jpeg;base64,${personalImage.toString('base64')}`;
            } catch (err) {
                console.error('Error processing personal image:', err);
                return res.status(500).json({ success: false, message: 'Error processing personal image.' });
            }
        }

        // Insert the record into the database
        db.run(
            `INSERT INTO records (name, country, image, personal_image, website, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, country, artworkImageBase64, personalImageBase64, website, description],
            function (err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ success: false, message: 'Database error.' });
                }
                res.json({ success: true, id: this.lastID });
            }
        );
    } catch (err) {
        console.error('Unexpected server error:', err);
        res.status(500).json({ success: false, message: 'Unexpected server error.' });
    }
});

app.get('/records', (req, res) => {
    const { sort = 'newest', country = '' } = req.query;

    let query = `SELECT * FROM records`;
    const params = [];

    if (country) {
        query += ` WHERE country LIKE ?`;
        params.push(`%${country}%`);
    }

    query += sort === 'newest'
        ? ' ORDER BY created_at DESC'
        : sort === 'oldest'
        ? ' ORDER BY created_at ASC'
        : sort === 'az'
        ? ' ORDER BY name COLLATE NOCASE ASC'
        : sort === 'za'
        ? ' ORDER BY name COLLATE NOCASE DESC'
        : '';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database query error' });
        res.json(rows);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

