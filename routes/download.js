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
} = require("../s3/s3");
router.use(logger("tiny"));

/* GET video page */
// video processing page
router.get("/", async function (req, res, next) {
  // Parse URL query string
  const filename = req.query.name;

  // Generate pre-signed URL for download
  const downloadURL = generateGetUrl(filename);
  const outputPath = `${filename}.mp4`;

  const ffmpegProcess = ffmpeg()
    .input(downloadURL) // Provide the presigned URL as the input
    .audioCodec("copy")
    .output(outputPath)
    .outputFormat("mp4")
    .on("start", function (commandLine) {
      console.log("Starting conversion...");
      console.log("FFmpeg command: " + commandLine);
    })
    .on("progress", function (progress) {
      console.log("Progress event triggered");
      console.log("Processing: " + progress.percent + "% done");
      res.write("Processing: " + progress.percent + "% done\n");
    })
    .on("end", function () {
      // Upload processed video to S3
      // uploadFileToS3(s3, filename, pass, res);

      const params = {
        Bucket: bucketName,
        Key: outputPath,
        Body: fs.createReadStream(outputPath),
      };

      s3.upload(params, function (err, data) {
        if (err) {
          console.log("Error uploading video: ", err);
          res.status(500).render("error", { err });
        } else {
          console.log("Converted video upload successful!");
        }
      });

      res.write("success");
      res.end();
    })
    .on("error", function (err) {
      console.error("Error converting video:", err.message);
      console.error("ffmpeg stderr:", err.stderr);
      res.status(500).render("error", { err });
      console.error("Conversion failed at an earlier stage.");
    });
  // .pipe(uploadFileToS3(s3, filename, res));

  ffmpegProcess.run();

  // fs.unlinkSync(outputPath);

  // .pipe(putObjectS3(s3, filename));

  // try {
  //   // Get video from S3 bucket
  //   const objectKey = filename;
  //   const getObjectParams = {
  //     Bucket: bucketName,
  //     Key: objectKey,
  //   };

  //   s3.getObject(getObjectParams, async (err, data) => {
  //     if (err) {
  //       console.error("Error fetching the image from S3:", err);
  //       res.status(500).render("error", { err });
  //     } else {

  //       const videoBuffer = data.Body;

  //       const readableStream = new stream.PassThrough();
  //       readableStream.end(videoBuffer);

  //       // Get video metadata
  //       ffmpeg.ffprobe(readableStream, (err, metadata) => {
  //         if (err) {
  //           console.error("Error probing video format:", err);
  //           res.status(500).render("error", { err });
  //         } else {
  //           const inputFormats = metadata.format.format_name.split(","); // Split the formats
  //           const inputFormat = inputFormats[0].trim(); // Get the first format

  //           console.log(inputFormat);

  //           // const convertedVideo = `${filename}.mp4`;

  //           ffmpeg()
  //             .input(videoBuffer)
  //             .inputFormat(inputFormat)
  //             .outputFormat("mp4")
  //             .on("end", function () {
  //               // Upload processed video to S3
  //             })
  //             .on("error", function (err) {
  //               console.error("Error converting video:", err);
  //               res.status(500).render("error", { err });
  //             })
  //             .pipe(putObjectS3(s3, filename));
  //         }
  //       });
  //     }
  //   });
  // } catch (err) {
  //   console.error("Error fetching the video from S3:", err);
  //   res.status(500).render("error", { err });
  // }
});

async function uploadFileToS3(s3, videoName, res) {
  const pass = new stream.PassThrough();
  const params = {
    Bucket: bucketName,
    Key: videoName,
    Body: pass,
    ContentType: "video/mp4",
  };

  s3.upload(params, function (err, data) {
    if (err) {
      console.log("Error uploading video: ", err);
      res.status(500).render("error", { err });
    } else {
      console.log("Converted video upload successful!");
    }
  });
}

// const putObjectS3 = function (s3, filename) {
//   const pass = new stream.PassThrough();
//   const putObjectParams = {
//     Bucket: bucketName,
//     Key: filename,
//     Body: pass,
//     ContentType: "video/mp4",
//   };

//   s3.putObject(putObjectParams, (err, data) => {
//     if (err) {
//       console.error("Error uploading the video to S3:", err);
//     } else {
//       console.log("Converted video upload successful!");
//     }
//   });
// };

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
