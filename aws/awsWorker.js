const AWS = require("aws-sdk");
const ffmpeg = require("fluent-ffmpeg");
const { generateGetUrl, bucketName, s3 } = require("./s3"); // Import necessary S3 related functions and variables
const fs = require("fs");
require("dotenv").config();

// Configure AWS with your credentials and region
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" }); // Initialize SQS with the specified API version
const queueName = "DotMediaQueue"; // Name of your SQS queue
let queueUrl; // This will store the URL of the SQS queue

// Retrieves the SQS queue URL or creates a new queue if it doesn't exist
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

// Processes the video by converting it and uploading the result to S3
function processVideo(videoID, receiptHandle) {
  const downloadURL = generateGetUrl(videoID); // Generate a presigned URL for downloading the video

  const outputFileName = videoID.split(".").slice(0, -1).join("."); // Remove the file extension from the videoID
  const outputPath = `${outputFileName}.mp4`; // Set the output file path

  // Set up the ffmpeg process for video conversion
  const ffmpegProcess = ffmpeg()
    .input(downloadURL) // Input the presigned URL
    .audioCodec("copy") // Copy the audio codec
    .output(outputPath) // Set the output file path
    .outputFormat("mp4") // Set the output format to mp4
    .on("start", function (commandLine) {
      console.log("Starting conversion...");
      console.log("FFmpeg command: " + commandLine);
      // Extend the visibility timeout of the message in the SQS queue
      const visibilityTimeout = 60;
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
      console.log("Conversion completed.");
      // Read the converted file
      fs.readFile(outputPath, (err, data) => {
        if (err) throw err;

        const params = {
          Bucket: bucketName, // Specify the S3 bucket
          Key: outputPath, // Specify the file key in the bucket
          Body: data, // Provide the file data
        };

        // Upload the converted file to S3
        s3.upload(params, function (s3Err, data) {
          if (s3Err) throw s3Err;
          console.log(`File uploaded successfully at ${data.Location}`);

          // Delete the processed message from the SQS queue
          const deleteParams = {
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
          };

          sqs.deleteMessage(deleteParams, function (err, data) {
            if (err) {
              console.log("Delete Error", err);
            } else {
              console.log("Message Deleted", data);
              pollForMessages(); // Continue polling for new messages
              // Remove the local file
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
      pollForMessages(); // Continue polling for new messages even after an error
    })
    .run(); // Run the FFmpeg command
}

// Polls the SQS queue for new messages
function pollForMessages() {
  console.log("Polling for messages...");
  const receiveParams = {
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10, // Maximum number of messages to retrieve
    VisibilityTimeout: 60, // Visibility timeout for the message
    WaitTimeSeconds: 20, // Enable long polling for efficiency
  };

  sqs.receiveMessage(receiveParams, function (err, data) {
    if (err) {
      console.log("Receive Error", err);
    } else if (data.Messages) {
      console.log(data.Messages[0].Body);
      const message = JSON.parse(data.Messages[0].Body); // Parse the message body
      processVideo(message.videoID, data.Messages[0].ReceiptHandle); // Process the video using the message details
    } else {
      pollForMessages(); // Continue polling if no messages are received
    }
  });
}

// Initialize the process by retrieving the SQS queue URL and starting to poll for messages
async function init() {
  await getQueueUrl();
  pollForMessages();
}

init(); // Start the application
