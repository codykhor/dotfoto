const axios = require("axios");
var express = require("express");
const logger = require("morgan");
var router = express.Router();
const stream = require("stream");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
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
  // Parse URL query string
  const filename = req.query.name;
  const outputFileName = filename.split(".").slice(0, -1).join(".");
  console.log(outputFileName);
  const outputPath = `${outputFileName}.mp4`;
  console.log(outputPath);
  res.render("download", { outputPath });
});

//   const ffmpegProcess = ffmpeg()
//     .input(downloadURL) // Provide the presigned URL as the input
//     .audioCodec("copy")
//     .output(outputPath)
//     .outputFormat("mp4")
//     .on("start", function (commandLine) {
//       console.log("FFmpeg command: " + commandLine);
//     })
//     .on("progress", function (progress) {
//       console.log("Processing: " + progress.percent + "% done");
//     })
//     .on("end", function () {
//       // Upload processed video to S3
//       const params = {
//         Bucket: bucketName,
//         Key: outputPath,
//         Body: fs.createReadStream(outputPath),
//       };

//       s3.upload(params, function (err, data) {
//         if (err) {
//           console.log("Error uploading video: ", err);
//           res.status(500).render("error", { err });
//         } else {
//           console.log("Converted video upload successful!");
//           fs.unlink(outputPath, (err) => {
//             if (err) {
//               console.error("Error removing local file:", err);
//             } else {
//               console.log("Local file removed successfully");
//             }
//           });
//           res.render("download", { outputPath });
//         }
//       });
//     })
//     .on("error", function (err) {
//       console.error("Error converting video:", err.message);
//       console.error("ffmpeg stderr:", err.stderr);
//       res.status(500).render("error", { err });
//     });

//   ffmpegProcess.run();
// });

// async function uploadFileToS3(s3, videoName, res) {
//   const pass = new stream.PassThrough();
//   const params = {
//     Bucket: bucketName,
//     Key: videoName,
//     Body: pass,
//     ContentType: "video/mp4",
//   };

//   s3.upload(params, function (err, data) {
//     if (err) {
//       console.log("Error uploading video: ", err);
//       res.status(500).render("error", { err });
//     } else {
//       console.log("Converted video upload successful!");
//     }
//   });
// }

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
