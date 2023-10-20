var express = require("express");
var router = express.Router();
const AWS = require("aws-sdk");
const multer = require("multer");
require("dotenv").config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

const s3 = new AWS.S3();

const bucketName = "DotFoto-image-s3";

//function to create S3 bucket if not exist
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

//using memoryStorage as a buffer
const storage = multer.memoryStorage();

//restrict the file types to JPEG, JPG and PNG
const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "DotFoto" });
});

//handle the upload
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const params = {
    Bucket: bucketName,
    Key: req.file.originalname,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };

  try {
    await s3.upload(params).promise();
    res.status(200).send("File uploaded to S3 successfully!");
  } catch (error) {
    console.error(error);
    res.status(500).render("index", {
      title: "DotFoto",
      errorMessage: "Error uploading file to S3. Please retry.",
    });
  }
});

module.exports = router;
