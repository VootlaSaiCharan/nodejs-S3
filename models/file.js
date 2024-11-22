const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    fileName: { type: String, required: true },
    s3Key: { type: String, required: true },
    s3Url: { type: String, required: true },
    compressedKey: { type: String, required: true },
    compressedUrl: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);