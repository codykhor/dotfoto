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
} = require("../s3/s3");

router.use(logger("tiny"));

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

// Handle the download process
// router.post("/transfer", async (req, res) => {
//   const filename = req.body.filename;

//   // Generate pre-signed URL for download
//   const downloadURL = generateGetUrl(filename);
//   console.log(filename, downloadURL);

//   if (!downloadURL) {
//     return res.status(500).render("error", { err });
//   } else {
//     return res.status(200).json({ downloadURL });
//   }
// });

module.exports = router;
