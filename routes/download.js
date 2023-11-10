// const axios = require("axios");
var express = require("express");
const logger = require("morgan");
var router = express.Router();
// const stream = require("stream");
// const fs = require("fs");
// const ffmpeg = require("fluent-ffmpeg");
// const {
//   generateGetUrl,
//   bucketName,
//   s3,
//   generatePresignedUrl,
// } = require("../aws/s3");
const { generateGetUrl, bucketName, s3 } = require("../aws/s3");

router.use(logger("tiny"));

/* GET video page */

router.get("/", async function (req, res, next) {
  // Parse URL query string
  const filename = req.query.name;
  const outputFileName = filename.split(".").slice(0, -1).join(".");
  console.log(outputFileName);
  const outputPath = `${outputFileName}.mp4`;
  console.log(outputPath);
  res.render("download", { outputPath });
});

// Handle the download process
router.post("/transfer", async (req, res) => {
  const filename = req.body.filename;
  const outputFileName = filename.split(".").slice(0, -1).join(".") + ".mp4";

  // Generate pre-signed URL for download
  const downloadURL = generateGetUrl(outputFileName);

  if (!downloadURL) {
    return res.status(500).render("error", { err });
  } else {
    return res.status(200).json({ downloadURL });
  }
});

// Check if file exists in S3
router.get("/check-file", async (req, res) => {
  const filename = req.query.name;
  const params = {
    Bucket: bucketName,
    Key: filename,
  };

  console.log("Checking file:", filename);
  console.log("Bucket name:", bucketName);

  try {
    await s3.headObject(params).promise();
    console.log("File Found in S3");
    res.status(200).send();
  } catch (err) {
    console.error("File not Found ERROR:", err);
    console.error("Error code:", err.code);
    res.status(404).send();
  }
});

module.exports = router;
