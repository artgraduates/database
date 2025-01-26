const express = require('express');
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

app.get('/countries', (req, res) => {
    db.all('SELECT DISTINCT country FROM records', [], (err, rows) => {
        if (err) {
            console.error('Error fetching countries:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        const countries = rows.map(row => row.country);
        res.json(countries);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

