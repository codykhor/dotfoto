const axios = require("axios");
var express = require("express");
const AWS = require("aws-sdk");
const logger = require("morgan");
var router = express.Router();
// const stream = require("stream");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const {
  generateGetUrl,
  bucketName,
  s3,
  generatePresignedUrl,
} = require("../aws/s3");
const { resolve } = require("path");
require("dotenv").config();
router.use(logger("tiny"));

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

const receiveParams = {
  QueueUrl: process.env.AWS_SQS_URL,
  MaxNumberOfMessages: 10,
  VisibilityTimeout: 60,
  WaitTimeSeconds: 20, // Enable long polling
};

/* GET video page */
// video processing page
router.get("/", async function (req, res, next) {
  try {
    const outputPath = await pollForMessages();

    if (outputPath) {
      console.log(outputPath);
      res.render("download", { outputPath });
    } else {
      res.render("loading");
    }
  } catch (err) {
    res.status(500).render("error", { err });
  }
});

// function pollForMessages() {
//   return new Promise(async (resolve, reject) => {
//     sqs.receiveMessage(receiveParams, async (err, data) => {
//       if (err) {
//         console.log("Receive Error", err);
//         // Retry after 5 secs
//         setTimeout(pollForMessages, 5000);
//       } else if (data.Messages) {
//         try {
//           console.log(data.Messages[0].Body);
//           const message = JSON.parse(data.Messages[0].Body);
//           processVideo(message.videoID, data.Messages[0].ReceiptHandle); // Pass the ReceiptHandle to processVideo
//         } catch (err) {
//           console.log(err);
//           reject(err);
//         }
//       } else {
//         // Only poll for new messages if there are no messages currently being processed
//         setTimeout(async () => {
//           try {
//             const outputPath = await pollForMessages();
//             resolve(outputPath);
//           } catch (error) {
//             reject(error);
//           }
//         }, 5000);
//         // pollForMessages();
//       }
//     });
//   });
// }

async function pollForMessages() {
  try {
    const data = await receiveMessage();
    if (data.Messages) {
      console.log(data.Messages[0].Body);
      const message = JSON.parse(data.Messages[0].Body);
      const videoID = message.videoID;
      const receiptHandle = data.Messages[0].ReceiptHandle;
      const outputPath = await processVideo(videoID, receiptHandle); // Pass the ReceiptHandle to processVideo

      return outputPath;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return await pollForMessages();
    }
  } catch (err) {
    console.log(err);
    return await pollForMessages();
  }
}

async function receiveMessage() {
  return new Promise((resolve, reject) => {
    sqs.receiveMessage(receiveParams, (err, data) => {
      if (err) {
        console.log("Receive Error", err);
        setTimeout(() => receiveMessage(), 5000);
      } else {
        resolve(data);
      }
    });
  });
}

function processVideo(videoID, receiptHandle) {
  return new Promise((resolve, reject) => {
    // Generate pre-signed URL for download
    try {
      const downloadURL = generateGetUrl(videoID);

      // Remove the file extension from the videoID for the output file
      const outputFileName = videoID.split(".").slice(0, -1).join(".");
      const outputPath = `${outputFileName}.mp4`;

      const ffmpegProcess = ffmpeg()
        .input(downloadURL) // Provide the presigned URL as the input
        .audioCodec("copy")
        .output(outputPath)
        .outputFormat("mp4")
        .on("start", function (commandLine) {
          console.log("FFmpeg command: " + commandLine);
        })
        .on("progress", function (progress) {
          console.log("Processing: " + progress.percent + "% done");
        })
        .on("end", function () {
          // Upload processed video to S3
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

              // Delete the message from the SQS queue
              const deleteParams = {
                QueueUrl: process.env.AWS_SQS_URL,
                ReceiptHandle: receiptHandle,
              };

              sqs.deleteMessage(deleteParams, function (err, data) {
                if (err) {
                  console.log("Delete Error", err);
                } else {
                  console.log("Message Deleted", data);

                  // Remove local file
                  fs.unlink(outputPath, (err) => {
                    if (err) {
                      console.error("Error removing local file:", err);
                    } else {
                      console.log("Local file removed successfully");
                    }
                  });
                }
              });
              resolve(outputPath);
            }
          });
        })
        .on("error", function (err) {
          console.error("Error converting video:", err.message);
          console.error("ffmpeg stderr:", err.stderr);
          reject(err);
        });
      ffmpegProcess.run();
    } catch (err) {
      console.log(err);
      reject(err);
    }
  });
}

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

  // Generate pre-signed URL for download
  const downloadURL = generateGetUrl(filename);

  if (!downloadURL) {
    return res.status(500).render("error", { err });
  } else {
    return res.status(200).json({ downloadURL });
  }
});

module.exports = router;
