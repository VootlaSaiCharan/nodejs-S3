const express = require('express'); // Import express
const imageRouter = express.Router(); // Create a new router instance
const File = require('../models/file'); // Import the File model
const { S3, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'); // Import S3 client
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs'); // Import fs for file system operations
const multer = require('multer'); // Import multer for file uploads
const path = require('path');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const upload = multer({ dest: uploadsDir });

// Configure AWS S3 with explicit credentials
const s3 = new S3({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Add validation check
const validateAwsConfig = () => {
    const requiredEnvVars = {
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        AWS_REGION: process.env.AWS_REGION,
        AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME
    };

    const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        throw new Error(`Missing required AWS environment variables: ${missingVars.join(', ')}`);
    }
};

// Call validation at startup
validateAwsConfig();

// Add this console log to verify credentials are loaded
console.log('AWS Configuration:', {
    region: process.env.AWS_REGION,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    bucketName: process.env.AWS_BUCKET_NAME
});

// Example route (update from `router.get()` to `imageRouter.get()`)
imageRouter.get('/', (req, res) => {
    console.log('GET request to /api/images');
    res.send('List of images');
});

// Helper function for date formatting
const formatDate = (date) => {
    return date.toISOString().replace(/[:.]/g, '-');
};

// Upload route
imageRouter.post('/upload', upload.single('image'), async (req, res) => {
    try {
         // Ensure that a file has been uploaded
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        // The `file` variable is defined here
        const file = req.file;
        const fileSizeBytes = file.size; // Get the size of the uploaded file in bytes
        const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2); // Convert to MB and round to 2 decimal places
        const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'); // Sanitize the original filename 
        // const fileName = `images/${sanitizedFileName}`;  // Use only the sanitized filename
        const fileName = sanitizedFileName; // Use the sanitized file name directly

        // Upload parameters without ACL
        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype
        };

        console.log('Uploading file with params:', {
            Bucket: uploadParams.Bucket,
            Key: uploadParams.Key,
            ContentType: uploadParams.ContentType
        });

        // Upload to S3
        const command = new PutObjectCommand(uploadParams);
        await s3.send(command);

        // Generate a pre-signed URL for viewing
        const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName
        });
        
        // The Image has to expire in 5min
        const signedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 300 });

        // Save to MongoDB
        const newFile = new File({
            fileName: sanitizedFileName,
            s3Key: fileName,
            s3Url: signedUrl,
            fileType: file.mimetype,
            fileSize: fileSizeMB // Save file size in MB
        });

        await newFile.save();

        // Clean up temp file
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });

        // Send back the response including the file size in MB
        res.json({ 
            success: true, 
            fileId: newFile._id,
            fileUrl: signedUrl,
            fileSize: fileSizeMB // Include file size in MB in response
        });

    } catch (error) {
        console.error('Upload error:', error);
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// View route
imageRouter.get('/view-image/:id', async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ success: false, error: 'File not found' });
        }

        // Generate a new pre-signed URL
        const getObjectCommand = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: file.s3Key
        });
        
        const signedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });

        console.log('Generated signed URL for viewing:', {
            fileId: file._id,
            fileName: file.fileName,
            s3Key: file.s3Key
        });

        // Include file size in the response
        res.json({ 
            success: true, 
            file: {
                ...file.toObject(),
                s3Url: signedUrl,
                fileSize: file.fileSize // Include file size from the database
            }
        });
    } catch (error) {
        console.error('Error fetching file metadata:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = imageRouter; // Export the router