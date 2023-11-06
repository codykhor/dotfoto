require("dotenv").config();
const axios = require("axios");
var express = require("express");
const AWS = require("aws-sdk");
const logger = require("morgan");
const { head } = require(".");
var router = express.Router();

router.use(logger("tiny"));

const s3 = new AWS.S3();
const bucketName = "dotfoto-image-s3";

/* GET video page */
// video processing page
async function checkComplete(outputPath) {
  try {
    await s3
      .headObject({
        Bucket: bucketName,
        Key: outputPath,
      })
      .promise();
    console.log(`File '${outputPath}' found in S3!`);
    return true; // Return true if file exists
  } catch (err) {
    if (err.code === "NotFound") {
      return false; // Return false if file not found
    }
    console.error(`Error checking file '${outputPath}' in S3:`, err);
    throw err; // Re-throw the error for further handling
  }
}
router.get("/", async function (req, res, next) {
  async function waitForS3File() {
    try {
      const name = req.query.name;
      const outputFileName = name.split(".").slice(0, -1).join(".");
      const outputPath = `${outputFileName}.mp4`;
      const maxWaitTime = 10000; // 10 seconds
      const pollInterval = 1000; // 1 second
      let elapsedTime = 0;

      while (elapsedTime < maxWaitTime) {
        const isFileFound = await checkComplete(outputPath);
        if (isFileFound) {
          res.render("download", { outputPath });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        elapsedTime += pollInterval;
      }
      // Max wait time exceeded and file not found
      res.status(500).render("error", {
        message: "Maximum wait time exceeded and file not found.",
      });
    } catch (err) {
      res.status(500).render("error", { err });
    }
  }
});

// Create pre-signed GET URL to download video
const generateGetUrl = (filename) => {
  const params = {
    Bucket: bucketName,
    Key: filename,
    Expires: expiryTime,
  };
  try {
    const signedUrl = s3.getSignedUrl("getObject", params);
    return signedUrl;
  } catch (err) {
    console.log(`Error generating pre-signed URL: ${err}`);
    throw err;
  }
};
// Handle the download process
router.post("/transfer", async (req, res) => {
  const filename = req.body.filename;
  try {
    // Generate pre-signed URL for download
    const downloadURL = generateGetUrl(filename);

    if (!downloadURL) {
      throw new Error("Failed to generate download URL.");
    }

    return res.status(200).json({ downloadURL });
  } catch (error) {
    console.error(error);
    return res.status(500).render("error", {
      message: "Error occurred while generating download URL.",
    });
  }
});

module.exports = router;
