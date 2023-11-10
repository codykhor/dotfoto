const express = require("express");
const logger = require("morgan");
const { generateGetUrl, bucketName, s3 } = require("../aws/s3");

var router = express.Router();
router.use(logger("tiny"));

// GET route for the video page
router.get("/", async function (req, res, next) {
  // Extract the filename from the query string
  const filename = req.query.name;
  const outputFileName = filename.split(".").slice(0, -1).join(".");
  const outputPath = `${outputFileName}.mp4`;

  // Render the download page with the output path
  res.render("download", { outputPath });
});

// POST route to handle the download process
router.post("/transfer", async (req, res) => {
  const filename = req.body.filename;
  const outputFileName = filename.split(".").slice(0, -1).join(".") + ".mp4";

  // Generate a pre-signed URL for the download
  const downloadURL = generateGetUrl(outputFileName);

  // Check if the download URL was generated successfully
  if (!downloadURL) {
    return res
      .status(500)
      .render("error", { error: "Failed to generate download URL" });
  } else {
    return res.status(200).json({ downloadURL });
  }
});

// GET route to check if the file exists in S3
router.get("/check-file", async (req, res) => {
  const filename = req.query.name;
  const params = {
    Bucket: bucketName,
    Key: filename,
  };

  try {
    // Check if the file exists in S3
    await s3.headObject(params).promise();
    res.status(200).send();
  } catch (err) {
    console.error("File not Found ERROR:", err.message);
    res.status(404).send();
  }
});

module.exports = router;
