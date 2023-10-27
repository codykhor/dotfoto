const axios = require("axios");
var express = require("express");
const logger = require("morgan");
var router = express.Router();
const { generateGetUrl, bucketName, s3 } = require("../s3/s3");
const { processImage } = require("../sharp/imageProcess");

router.use(logger("tiny"));

/* GET image page */
// image processing page
router.get("/", async function (req, res, next) {
  // Parse URL query string
  const filename = req.query.name;
  const width = parseInt(req.query.width, 10);
  const height = parseInt(req.query.height, 10);
  const density = parseInt(req.query.density, 10);

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
        const resizedImage = await processImage(
          imageBuffer,
          width,
          height,
          density
        );

        // Load image on browser
        const resizedImageDataUri = `data:image/jpeg;base64,${resizedImage.toString(
          "base64"
        )}`;

        // Upload processed image to S3
        const targetKey = "processed-" + filename;
        const putObjectParams = {
          Bucket: bucketName,
          Key: targetKey,
          Body: resizedImage,
          ContentType: "image/jpeg",
        };

        s3.putObject(putObjectParams, (err, data) => {
          if (err) {
            console.error("Errpr uploading the image to S3:", err);
            res.status(500).render("error", { err });
          } else {
            // Send the resized image data as the responses
            res.render("download", { resizedImageDataUri, targetKey });
          }
        });
      }
    });
  } catch (err) {
    console.error("Error fetching the image from S3:", err);
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
