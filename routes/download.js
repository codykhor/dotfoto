const axios = require("axios");
var express = require("express");
const logger = require("morgan");
const sharp = require("sharp");
var router = express.Router();
const multer = require("multer");
const { generateGetUrl, bucketName, s3 } = require("../s3/s3");

router.use(logger("tiny"));

/* GET image page */
router.get("/", async function (req, res, next) {
  // Parse URL query string
  const filename = req.query.name;
  const width = parseInt(req.query.width, 10);
  const height = parseInt(req.query.height, 10);

  try {
    // Generate a pre-signed URL to get the image from S3
    const downloadURL = generateGetUrl(filename);

    const response = await axios.get(downloadURL, {
      responseType: "arraybuffer",
    });
    const imageBuffer = response.data;

    // Image processing logic
    const resizedImage = await sharp(imageBuffer)
      .resize(width, height)
      .toBuffer();

    // Load image on browser
    const resizedImageDataUri = `data:image/jpeg;base64,${resizedImage.toString(
      "base64"
    )}`;

    // Send the resized image data as the response
    res.render("download", { resizedImageDataUri });
  } catch (err) {
    console.error("Error fetching the image from S3:", err);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
