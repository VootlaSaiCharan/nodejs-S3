require('dotenv').config();
const { S3 } = require('@aws-sdk/client-s3');

async function testAwsCredentials() {
    const s3 = new S3({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });

    try {
        console.log('Testing AWS credentials...');
        console.log('AWS Configuration:', {
            region: process.env.AWS_REGION,
            hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
            bucketName: process.env.AWS_BUCKET_NAME
        });

        const buckets = await s3.listBuckets({});
        console.log('Successfully connected to AWS. Available buckets:', buckets.Buckets);
    } catch (error) {
        console.error('AWS Credentials test failed:', error);
    }
}

testAwsCredentials(); 