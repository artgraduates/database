const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { Pool } = require('pg');
const cors = require('cors');

// Initialize Express app
const app = express();

// Enable CORS
app.use(cors({
    origin: 'https://artgraduates-frontend.onrender.com', // Replace with your frontend URL
    methods: ['GET', 'POST'],
}));

// Middleware for JSON parsing and serving static files
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL Connection Configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://artgraduates_postgress_user:EsbeFmM3ieDRIiEbWRsmqMLMs5iYi1iz@dpg-cud91fdsvqrc73a10pl0-a.oregon-postgres.render.com/artgraduates_postgress",
    ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL
});

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Database (Create Table)
pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        artwork_image TEXT NOT NULL,
        personal_image TEXT,
        website TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) console.error('Error initializing database:', err.message);
});

// API Route to Handle Form Submissions
app.post('/submit', upload.fields([{ name: 'artworkImage' }, { name: 'personalImage' }]), async (req, res) => {
    const { name, country, website, description } = req.body;

    if (!name || !country || !website || !req.files.artworkImage) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled!' });
    }

    try {
        // Optimize artwork image
        const artworkImageBuffer = await sharp(req.files.artworkImage[0].buffer)
            .resize({ height: 900 }) // Resizing to a larger display size
            .jpeg({ quality: 80 })
            .toBuffer();
        const artworkImage = `data:image/jpeg;base64,${artworkImageBuffer.toString('base64')}`;

        let personalImage = null;
        if (req.files.personalImage) {
            const personalImageBuffer = await sharp(req.files.personalImage[0].buffer)
                .resize({ height: 900 }) // Resizing for better quality
                .jpeg({ quality: 80 })
                .toBuffer();
            personalImage = `data:image/jpeg;base64,${personalImageBuffer.toString('base64')}`;
        }

        // Insert into database
        const result = await pool.query(
            `INSERT INTO submissions (name, country, artwork_image, personal_image, website, description)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [name, country, artworkImage, personalImage, website, description]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error('Error processing submission:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// API Route to Fetch Submissions with Filtering and Sorting
app.get('/records', async (req, res) => {
    const { filterCountry, sort } = req.query;

    let query = 'SELECT * FROM submissions';
    const queryParams = [];

    if (filterCountry) {
        query += ' WHERE country = $1';
        queryParams.push(filterCountry);
    }

    if (sort === 'oldest') {
        query += ' ORDER BY created_at ASC';
    } else if (sort === 'newest') {
        query += ' ORDER BY created_at DESC';
    } else if (sort === 'name') {
        query += ' ORDER BY name';
    }

    try {
        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching records:', err.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});

