const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const db = new sqlite3.Database(':memory:'); // Use file DB for production

// Create table
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

// Serve static files
app.use(express.static('public'));

// Handle form submission
app.post('/submit', upload.single('image'), async (req, res) => {
    try {
        const { name, country, website } = req.body;

        // Resize image
        const optimizedImage = await sharp(req.file.buffer)
            .resize({ height: 300 })
            .jpeg({ quality: 80 })
            .toBuffer();
        const imageBase64 = `data:image/jpeg;base64,${optimizedImage.toString('base64')}`;

        // Insert into DB
        db.run(
            `INSERT INTO records (name, country, image, website) VALUES (?, ?, ?, ?)`,
            [name, country, imageBase64, website],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true });
            }
        );
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Fetch records
app.get('/records', (req, res) => {
    db.all(`SELECT * FROM records ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json(rows);
    });
});

// Start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

