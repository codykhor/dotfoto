var express = require("express");
var router = express.Router();
const AWS = require("aws-sdk");
const multer = require("multer");
const { generatePresignedUrl, bucketName, s3 } = require("../s3/s3");

// Using memoryStorage as a buffer
const storage = multer.memoryStorage();

// Restrict the file types to JPEG, JPG and PNG
const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "DotFoto" });
});

// handle the upload
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const params = {
    Bucket: bucketName,
    Key: req.file.originalname,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
  };

  // Upload image to S3
  s3.upload(params, (err, data) => {
    if (err) {
      console.log(`Error uploading file: ${err}`);
      res.status(500).render("index", {
        title: "DotFoto",
        errorMessage: "Error uploading file to S3. Please retry.",
      });
    } else {
      // Generate pre-signed URL
      const upload_url = generatePresignedUrl(
        req.file.originalname,
        req.file.mimetype
      );
      res.status(200).send("File uploaded to S3 successfully!");
    }
  });
});

module.exports = router;
