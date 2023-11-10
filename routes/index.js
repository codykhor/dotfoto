const express = require("express");
const logger = require("morgan");
const multer = require("multer");
const { generatePresignedUrl } = require("../aws/s3");
const { sendSQSMessage } = require("../aws/sqs");

const router = express.Router();
router.use(logger("tiny"));

// Configure multer for memory storage and file type restrictions
const storage = multer.memoryStorage();
const allowedMimeTypes = [
  "video/avi",
  "video/x-matroska",
  "video/x-flv",
  "video/x-ms-wmv",
  "video/webm",
  "video/mpeg",
  "video/3gpp",
  "video/quicktime",
];
const fileFilter = (req, file, cb) => {
  cb(null, allowedMimeTypes.includes(file.mimetype));
};
const upload = multer({ storage: storage, fileFilter: fileFilter });

// Route for the home page
router.get("/", function (req, res, next) {
  res.render("index", { title: "DotMedia" });
});

// Route to handle video uploads
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  try {
    const { presignedURL, newFileName } = generatePresignedUrl(
      req.file.originalname,
      req.file.mimetype
    );

    if (!presignedURL) {
      throw new Error("Failed to generate presigned URL");
    }

    return res.status(200).json({ presignedURL, newFileName });
  } catch (error) {
    return res.status(500).send("Error uploading file: " + error.message);
  }
});

// Route to send a message to the SQS queue
router.post("/send-sqs-message", async (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).send("Filename is required.");
  }

  try {
    const messageBody = { videoID: filename };
    await sendSQSMessage(JSON.stringify(messageBody));
    return res.status(200).send("SQS message sent successfully!");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error sending SQS message: " + error.message);
  }
});

module.exports = router;
