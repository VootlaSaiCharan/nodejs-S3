require('dotenv').config();

const express = require('express');
const aws = require('aws-sdk');
const fileUpload = require('express-fileupload');
const path = require('path');
const app = express();
const port = 3000;

// Configure AWS
// const s3 = new aws.S3({
//     accessKeyId: 'AWS_ACCESS_KEY_ID',
//     secretAccessKey: 'AWS_SECRET_ACCESS_KEY',
//     region: 'AWS_REGION'
// });

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION // Make sure to include region if necessary
});

// Function to format date
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.post('/upload', async (req, res) => {
    try {
        if (!req.files || !req.files.image) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const file = req.files.image;
        // Remove spaces and special characters from filename
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        // const fileName = `images/${Date.now()}-${sanitizedFileName}`;
        const formattedDate = formatDate(new Date());
        const fileName = `images/${formattedDate}-${sanitizedFileName}`;


        const params = {
            // Bucket: '11oct.aws',
            Bucket: process.env.AWS_BUCKET_NAME, // Use bucket name from environment variable
            Key: fileName,
            Body: file.data,
            ContentType: file.mimetype
        };

        const uploadResult = await s3.upload(params).promise();
        res.json({ success: true, key: uploadResult.Key });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/view-image/:key(*)', async (req, res) => {
    try {
        const key = decodeURIComponent(req.params.key);
        console.log('Requested key:', key);

        const params = {
            // Bucket: '11oct.aws',
            Bucket: process.env.AWS_BUCKET_NAME, // Use bucket name from environment variable
            Key: key,
            Expires: 60
        };

        try {
            // Check if the object exists first
            await s3.headObject({ Bucket: '11oct.aws', Key: key }).promise();
            
            const url = await s3.getSignedUrlPromise('getObject', params);
            res.json({ url });
        } catch (error) {
            if (error.code === 'NotFound') {
                res.status(404).json({ error: 'Image not found' });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('View image error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});