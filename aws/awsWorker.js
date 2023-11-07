const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const { generateGetUrl, bucketName, s3 } = require("./s3");
const fs = require("fs");
require("dotenv").config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

const queueName = "dotMedia-queue";

let queueUrl;

async function getQueueUrl() {
  try {
    const data = await sqs.getQueueUrl({ QueueName: queueName }).promise();
    queueUrl = data.QueueUrl;
    console.log("SQS queue retrieved successfully", queueName);
  } catch (error) {
    if (error.code === "AWS.SimpleQueueService.NonExistentQueue") {
      console.log("Queue does not exist. Creating a new one...");
      const data = await sqs.createQueue({ QueueName: queueName }).promise();
      queueUrl = data.QueueUrl;
      console.log("SQS queue created successfully", queueName);
    } else {
      console.log("Error getting SQS queue URL", error);
      throw error;
    }
  }
}

// video processing
function processVideo(videoID, receiptHandle) {
  // Generate pre-signed URL for download
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
      console.log("Starting conversion...");
      console.log("FFmpeg command: " + commandLine);
      const visibilityTimeout = 60; // Extend the visibility timeout

      sqs.changeMessageVisibility(
        {
          QueueUrl: queueUrl,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: visibilityTimeout,
        },
        function (err, data) {
          if (err) {
            console.log("Error changing message visibility", err);
          } else {
            console.log(
              `Message visibility extended to ${visibilityTimeout} seconds`
            );
          }
        }
      );
    })
    .on("progress", function (progress) {
      console.log("Processing: " + progress.percent + "% done");
    })
    .on("end", function () {
      console.log("conversion completed.");
      fs.readFile(outputPath, (err, data) => {
        if (err) throw err;

        const params = {
          Bucket: bucketName,
          Key: outputPath,
          Body: data,
        };

        // Upload the file to S3
        s3.upload(params, function (s3Err, data) {
          if (s3Err) throw s3Err;
          console.log(`File uploaded successfully at ${data.Location}`);
          console.log("im here!");

          // Delete the message from the SQS queue
          const deleteParams = {
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
          };

          sqs.deleteMessage(deleteParams, function (err, data) {
            if (err) {
              console.log("Delete Error", err);
            } else {
              console.log("Message Deleted", data);
              pollForMessages();
              fs.unlink(outputPath, (err) => {
                if (err) {
                  console.error("Error removing local file:", err);
                } else {
                  console.log("Local file removed successfully");
                }
              });
            }
          });
        });
      });
    })
    .on("error", function (err) {
      console.error("Error converting video:", err.message);
      console.error("ffmpeg stderr:", err.stderr);
      console.error("Conversion failed at an earlier stage.");
      pollForMessages();
    })
    .run(); // Run the FFmpeg command
}

function pollForMessages() {
  console.log("Polling for messages...");
  const receiveParams = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 60,
    WaitTimeSeconds: 20, // Enable long polling
  };

  sqs.receiveMessage(receiveParams, function (err, data) {
    if (err) {
      console.log("Receive Error", err);
    } else if (data.Messages) {
      console.log(data.Messages[0].Body);
      const message = JSON.parse(data.Messages[0].Body);
      processVideo(message.videoID, data.Messages[0].ReceiptHandle); // Pass the ReceiptHandle to processVideo
    } else {
      // Only poll for new messages if there are no messages currently being processed
      pollForMessages();
    }
  });
}

// Start polling for messages
async function init() {
  await getQueueUrl();
  pollForMessages();
}

init();
