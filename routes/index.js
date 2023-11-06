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

router.use(logger("tiny"));
const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
const queueName = "dot-queue";

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

// * File configuration
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// * Multer configuration
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
    return res.status(200).json({ presignedURL, newFileName });
  }
});

async function sendSQSMessage(messageBodyString) {
  let queueUrl;
  try {
    // Try to get the URL of the existing queue
    const data = await sqs.getQueueUrl({ QueueName: queueName }).promise();
    queueUrl = data.QueueUrl;
    console.log("SQS queue retrieved successfully", queueName);
  } catch (error) {
    // create new queue if it doesn't exist
    if (error.code === "AWS.SimpleQueueService.NonExistentQueue") {
      const data = await sqs.createQueue({ QueueName: queueName }).promise();
      queueUrl = data.QueueUrl;
      console.log("SQS queue created successfully", queueName);
    } else {
      throw error;
    }
  }

  let sendParams = {
    MessageBody: messageBodyString,
    QueueUrl: queueUrl,
  };

  sqs.sendMessage(sendParams, function (err, data) {
    if (err) {
      console.log("Error sending SQS message", err);
    } else {
      console.log("SQS message sent successfully", data.MessageId);
    }
  });
}

router.post("/send-sqs-message", async (req, res) => {
  try {
    let messageBody = {
      videoID: req.body.filename,
    };

    currentVideoID = req.body.filename;
    console.log("🟢 currentVideoID:", currentVideoID);
    console.log("🟢", messageBody);

    // Convert the message body to a string
    let messageBodyString = JSON.stringify(messageBody);

    // Send the message to the SQS queue
    await sendSQSMessage(messageBodyString);

    return res.status(200).send("SQS message sent successfully!");
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .send("An error occurred while sending the SQS message.");
  }
});

module.exports = router;
