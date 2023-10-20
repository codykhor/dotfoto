const AWS = require("aws-sdk");
require("dotenv").config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

const s3 = new AWS.S3();

const bucketName = "dotfoto-image-s3";
const expiryTime = 3600; // 1 hour

// Function to create S3 bucket if doesn't exist
const createS3bucket = () => {
  const params = {
    Bucket: bucketName,
  };

  s3.createBucket(params, (err, data) => {
    if (err) {
      if (err.statusCode === 409) {
        console.log(`Bucket already exists: ${bucketName}`);
      } else {
        console.log(`Error creating bucket: ${err}`);
      }
    } else {
      console.log(`Created bucket: ${bucketName}`);
    }
  });
};

// Create the S3 bucket when the application starts
createS3bucket();

// Create pre-signed PUT URL to upload image
const generatePresignedUrl = (originalname, mimetype) => {
  const params = {
    Bucket: bucketName,
    Key: originalname,
    ContentType: mimetype,
    Expires: expiryTime,
  };

  try {
    const signedUrl = s3.getSignedUrl("putObject", params);
    return signedUrl;
  } catch (err) {
    console.log(`Error generating pre-signed URL: ${err}`);
  }
};

module.exports = {
  generatePresignedUrl,
  bucketName,
  s3,
};
