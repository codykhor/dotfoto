const AWS = require("aws-sdk");
const { PutBucketCorsCommand, S3Client } = require("@aws-sdk/client-s3");
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
      addCorsConfiguration();
    }
  });
};

// Function to add CORS configuration to the S3 bucket
const addCorsConfiguration = async () => {
  const client = new S3Client({ region: "ap-southeast-2" });

  const corsCommand = new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          // Allow all headers to be sent to this bucket.
          AllowedHeaders: ["*"],
          // Allow only GET and PUT methods to be sent to this bucket.
          AllowedMethods: ["GET", "POST", "PUT"],
          // Allow only requests from the specified origin(s).
          AllowedOrigins: ["*"], // Update with your allowed origins
          // Allow the entity tag (ETag) header to be returned in the response
        },
      ],
    },
  });

  try {
    const corsResponse = await client.send(corsCommand);
    console.log(`CORS configuration added to the bucket: ${bucketName}`);
  } catch (error) {
    console.error(`Error adding CORS configuration: ${error}`);
  }
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

// Create pre-signed GET URL to download image
const generateGetUrl = (originalname) => {
  const params = {
    Bucket: bucketName,
    Key: originalname,
    Expires: expiryTime,
  };

  try {
    const signedUrl = s3.getSignedUrl("getObject", params);
    return signedUrl;
  } catch (err) {
    console.log(`Error generating pre-signed URL: ${err}`);
  }
};

module.exports = {
  generatePresignedUrl,
  generateGetUrl,
  bucketName,
  s3,
};
