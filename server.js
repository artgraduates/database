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
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.post('/submit', upload.fields([{ name: 'image' }, { name: 'personalImage' }]), async (req, res) => {
    try {
        const { name, country, website, description } = req.body;

        if (!req.body.captcha || !name || !country || !website || !req.files['image']) {
            return res.status(400).json({ success: false, message: 'All required fields must be filled out!' });
        }

        // Process artwork image
        const artworkImage = await sharp(req.files['image'][0].buffer)
            .resize({ height: 900 }) // Resize to height 900px while maintaining aspect ratio
            .jpeg({ quality: 80 }) // Compress the image
            .toBuffer();

        const artworkImageBase64 = `data:image/jpeg;base64,${artworkImage.toString('base64')}`;

        // Process personal image (if provided)
        let personalImageBase64 = null;
        if (req.files['personalImage']) {
            const personalImage = await sharp(req.files['personalImage'][0].buffer)
                .resize({ height: 900 })
                .jpeg({ quality: 80 })
                .toBuffer();
            personalImageBase64 = `data:image/jpeg;base64,${personalImage.toString('base64')}`;
        }

        // Insert the record into the database
        db.run(
            `INSERT INTO records (name, country, image, personal_image, website, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, country, artworkImageBase64, personalImageBase64, website, description],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: 'Database error' });
                res.json({ success: true, id: this.lastID });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error occurred during image processing.' });
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
        if (err) return res.status(500).json({ success: false, error: 'Database query error' });
        res.json(rows);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

