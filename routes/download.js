require("dotenv").config();
const axios = require("axios");
var express = require("express");
const AWS = require("aws-sdk");
const logger = require("morgan");
var router = express.Router();
// const stream = require("stream");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const { resolve } = require("path");
const {
  generateGetUrl,
  bucketName,
  s3,
  generatePresignedUrl,
} = require("../aws/s3");

router.use(logger("tiny"));

/* GET video page */
// video processing page
router.get("/", async function (req, res, next) {
  try {
    console.log(req.query);
    // Wait for the SQS job to complete
    console.log("🟢 Waiting for message from queue...");
    // * get outputPath(filename in s3 bucket)
    const outputPath = req.query.name;
    const maxWaitTime = 10000; // Maximum wait time (10 seconds)
    const pollInterval = 1000; // Polling interval (1 second)
    let elapsedTime = 0;

    // Function to check if the processed image file exists in S3
    const checkComplete = async () => {
      try {
        await s3
          .getObject({
            Bucket: bucketName,
            Key: outputPath,
          })
          .promise();
        console.log("🟢 File found in S3!");
        return true; // Return true if file exists
      } catch (error) {
        // Return false if file does not exist or other errors occur
        return false;
      }
    };

    while (elapsedTime < maxWaitTime) {
      const conditionMet = await checkComplete();
      if (conditionMet) {
        break; // Exit the loop if the condition is met
      }

      // If the condition is not met, wait for the specified interval
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      elapsedTime += pollInterval;
    }
    res.render("download", { outputPath });
  } catch (err) {
    res.status(500).render("error", { err });
  }
});

// Handle the download process
router.post("/transfer", async (req, res) => {
  const filename = req.body.filename;

  // Generate pre-signed URL for download
  const downloadURL = generateGetUrl(filename);

  if (!downloadURL) {
    return res.status(500).render("error", { err });
  } else {
    return res.status(200).json({ downloadURL });
  }
});

module.exports = router;
