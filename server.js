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
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

const upload = multer({ storage: multer.memoryStorage() });

app.post('/submit', upload.fields([{ name: 'image' }, { name: 'personalImage' }]), async (req, res) => {
    try {
        const { name, country, website, description } = req.body;
        if (!req.body.captcha || !name || !country || !website || !req.files['image']) {
            return res.status(400).json({ success: false, message: 'All fields are required!' });
        }
        const artworkImage = await sharp(req.files['image'][0].buffer).resize({ height: 900 }).jpeg({ quality: 80 }).toBuffer();
        let personalImage = null;
        if (req.files['personalImage']) {
            personalImage = await sharp(req.files['personalImage'][0].buffer).resize({ height: 900 }).jpeg({ quality: 80 }).toBuffer();
        }
        db.run(`INSERT INTO records (name, country, image, personal_image, website, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [name, country, artworkImage.toString('base64'), personalImage ? personalImage.toString('base64') : null, website, description],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: 'Database error' });
                res.json({ success: true, id: this.lastID });
            });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

app.get('/records', (req, res) => {
    const { sort = 'newest', country = '' } = req.query;
    let query = `SELECT * FROM records`;
    const params = [];
    if (country) query += ` WHERE country = ?` && params.push(country);
    query += sort === 'newest' ? ' ORDER BY created_at DESC' : sort === 'oldest' ? ' ORDER BY created_at ASC' : '';
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

app.get('/countries', (req, res) => {
    db.all('SELECT DISTINCT country FROM records', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json(rows.map(r => r.country));
    });
});

app.listen(3000, () => console.log('Running at http://localhost:3000'));

