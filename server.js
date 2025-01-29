const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Multer Storage
const upload = multer({ storage: multer.memoryStorage() });

// Create Table if Not Exists
pool.query(`
    CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        name TEXT,
        country TEXT,
        image TEXT,
        image_self TEXT,
        website TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

// Form Submission Route
app.post('/submit', upload.fields([{ name: 'image' }, { name: 'imageSelf' }]), async (req, res) => {
    try {
        const { name, country, website, description } = req.body;

        if (!name || !country || !website) {
            return res.status(400).json({ success: false, error: "All required fields must be filled out!" });
        }

        const imageFile = req.files['image'] ? req.files['image'][0] : null;
        const imageSelfFile = req.files['imageSelf'] ? req.files['imageSelf'][0] : null;

        const imageBase64 = imageFile ? `data:image/jpeg;base64,${(await sharp(imageFile.buffer).resize({ height: 900 }).jpeg({ quality: 80 }).toBuffer()).toString('base64')}` : null;
        const imageSelfBase64 = imageSelfFile ? `data:image/jpeg;base64,${(await sharp(imageSelfFile.buffer).resize({ height: 900 }).jpeg({ quality: 80 }).toBuffer()).toString('base64')}` : null;

        await pool.query(
            `INSERT INTO records (name, country, image, image_self, website, description) VALUES ($1, $2, $3, $4, $5, $6)`,
            [name, country, imageBase64, imageSelfBase64, website, description]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Fetch Records
app.get('/records', async (req, res) => {
    const result = await pool.query("SELECT * FROM records ORDER BY created_at DESC");
    res.json(result.rows);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

