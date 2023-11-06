require("dotenv").config();
const axios = require("axios");
var express = require("express");
const AWS = require("aws-sdk");
const logger = require("morgan");
var router = express.Router();
const { generateGetUrl, bucketName, s3 } = require("../aws/s3");

router.use(logger("tiny"));

/* GET video page */
// video processing page
router.get("/", async function (req, res, next) {
  async function waitForS3File() {
    try {
      const name = req.query.name;
      const outputFileName = name.split(".").slice(0, -1).join(".");
      const outputPath = `${outputFileName}.mp4`;
      const maxWaitTime = 10000; // 10 seconds
      const pollInterval = 1000; // 1 second
      let elapsedTime = 0;

      const checkComplete = async () => {
        try {
          const headObjectResponse = await s3
            .headObject({
              Bucket: bucketName,
              Key: outputPath,
            })
            .promise();
          console.log("File found in S3!");
          return true; // Return true if file exists
        } catch (err) {
          if (err.code === "NotFound") {
            return false;
          }
          console.error(err);
          throw err;
        }
      };

      const isFileFound = await checkComplete();

      if (isFileFound) {
        // Renders when found file
        res.render("download", { outputPath });
        return;
      } else if (elapsedTime < maxWaitTime) {
        // Continue polling if max wait time is not exceeded
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        elapsedTime += pollInterval;
        await waitForS3File(); // Recursively call function to check again
      } else {
        // Max wait time exceeded and file not found
        res.status(500).render("error", { err });
      }
    } catch (err) {
      res.status(500).render("error", { err });
    }
  }

  // Start polling process
  waitForS3File();

  // try {
  //   // Wait for SQS to complete job
  //   console.log("Waiting for message from queue.");

  //   // get outputPath (filename in s3 bucket)
  //   const name = req.query.name;
  //   const outputFileName = name.split(".").slice(0, -1).join(".");
  //   const outputPath = `${outputFileName}.mp4`;
  //   const maxWaitTime = 10000; // 10 secs
  //   const pollInterval = 1000; // 1 sec
  //   let elapsedTime = 0;

  //   // Function to check if the processed image file exists in S3
  //   const checkComplete = async () => {
  //     try {
  //       await s3
  //         .getObject({
  //           Bucket: bucketName,
  //           Key: outputPath,
  //         })
  //         .promise();
  //       console.log("File found in S3!");
  //       return true; // Return true if file exists
  //     } catch (err) {
  //       // Return false if file does not exist or other errors occur
  //       console.log(err);
  //       return false;
  //     }
  //   };

  //   while (elapsedTime < maxWaitTime) {
  //     const conditionMet = await checkComplete();
  //     if (conditionMet) {
  //       break; // Exit the loop
  //     }

  //     // If the condition is not met, wait for the specified interval
  //     await new Promise((resolve) => setTimeout(resolve, pollInterval));
  //     elapsedTime += pollInterval;
  //   }
  //   res.render("download", { outputPath });
  // } catch (err) {
  //   res.status(500).render("error", { err });
  // }
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
