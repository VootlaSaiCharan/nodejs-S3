const dotenv = require('dotenv');
const result = dotenv.config();

console.log('Environment Variables Test');
console.log('-------------------------');
console.log('Dotenv Load Result:', result.error ? 'Error' : 'Success');
console.log('AWS Configuration:', {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not Set',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not Set',
    AWS_REGION: process.env.AWS_REGION,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME
}); 