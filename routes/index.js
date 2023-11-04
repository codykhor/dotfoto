var express = require("express");
const logger = require("morgan");
var router = express.Router();
const AWS = require("aws-sdk");
const multer = require("multer");
const {
  generatePresignedUrl,
  generateGetUrl,
  bucketName,
  s3,
} = require("../aws/s3");
const { sendSQSMessage, receiveSQSMessage } = require("../aws/sqs");

router.use(logger("tiny"));

// Using memoryStorage as a buffer
const storage = multer.memoryStorage();

// Restrict the file types
const allowedMimeTypes = [
  "video/avi",
  "video/x-matroska", // MKV
  "video/x-flv",
  "video/x-ms-wmv",
  "video/webm",
  "video/mpeg",
  "video/3gpp",
  "video/quicktime",
];
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
  res.render("index", { title: "DotMedia" });
});

// Handle the upload
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  // Generate pre-signed URL for upload
  const { presignedURL, newFileName } = generatePresignedUrl(
    req.file.originalname,
    req.file.mimetype
  );

  if (!presignedURL) {
    return res.status(500).render("error", { err });
  } else {
    let messageBody = {
      videoID: newFileName,
    };
    // Convert the message body to a string
    let messageBodyString = JSON.stringify(messageBody);
    // Send the message to the SQS queue
    sendSQSMessage(messageBodyString);
    return res.status(200).json({ presignedURL, newFileName });
  }
});

module.exports = router;
