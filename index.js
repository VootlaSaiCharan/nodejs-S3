const dotenv = require('dotenv');
// Load environment variables from .env file
const result = dotenv.config();

if (result.error) {
    console.error('Error loading .env file:', result.error);
    process.exit(1);
}

// Log loaded environment variables (remove in production)
console.log('Environment variables loaded:', {
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucketName: process.env.AWS_BUCKET_NAME,
    compressedBucketName: process.env.AWS_COMPRESSED_BUCKET_NAME,
});

// Rest of your imports
const express = require('express');
const mongoose = require('mongoose');
const imageRouter = require('./routes/image');

const app = express(); // Create an Express application

// Serve static files (HTML, CSS, JS)
app.use(express.static('public')); // This line serves the public directory

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use('/api/images', imageRouter); // Use the image router for image-related routes

// Add after your middleware setup
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Optional root route
app.get('/', (req, res) => {
    res.send('Welcome to the Image API');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false, 
        error: 'Something went wrong!' 
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
