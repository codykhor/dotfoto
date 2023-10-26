const axios = require("axios");
var express = require("express");
const logger = require("morgan");
var router = express.Router();
const { bucketName, s3 } = require("../s3/s3");
const { processImage } = require("../sharp/imageProcess");

router.use(logger("tiny"));

/* GET image page */
router.get("/", async function (req, res, next) {
  // Parse URL query string
  const filename = req.query.name;
  const width = parseInt(req.query.width, 10);
  const height = parseInt(req.query.height, 10);

  try {
    // Get image from S3 bucket
    const objectKey = filename;
    const getObjectParams = {
      Bucket: bucketName,
      Key: objectKey,
    };

    s3.getObject(getObjectParams, async (err, data) => {
      if (err) {
        console.error("Error fetching the image from S3:", err);
        res.status(500).render("error", { err });
      } else {
        const imageBuffer = data.Body;

        // Process image
        const resizedImage = await processImage(imageBuffer, width, height);

        // Load image on browser
        const resizedImageDataUri = `data:image/jpeg;base64,${resizedImage.toString(
          "base64"
        )}`;

        // Send the resized image data as the response
        res.render("download", { resizedImageDataUri });
      }
    });
  } catch (err) {
    console.error("Error fetching the image from S3:", err);
    res.status(500).render("error", { err });
  }
});

module.exports = router;
