const dotenv = require("dotenv");
dotenv.config();

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var downloadRouter = require("./routes/download");

var app = express();

const AWS = require("aws-sdk");

// * AWS Configuration
const sqs = new AWS.SQS({ region: "ap-southeast-2", apiVersion: "2012-11-05" });
const queueName = "dot-queue";

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/download", downloadRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

function receiveSQSMessage() {
  let receiveParams = {
    QueueUrl: "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 60,
    WaitTimeSeconds: 5,
  };

  // * SQS receive message from application
  sqs.receiveMessage(receiveParams, function (err, data) {
    if (err) {
      console.log("Receive Error", err);
    } else if (data.Messages) {
      let deleteParams = {
        QueueUrl:
          "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
        ReceiptHandle: data.Messages[0].ReceiptHandle,
      };
      sqs.deleteMessage(deleteParams, function (err, data) {
        if (err) {
          console.log("Delete Error", err);
        } else {
          console.log("Message Deleted", data);
        }
      });
    }
  });
}

// * Keep checking if there is a new message from application
async function pollForMessages() {
  try {
    const data = await receiveSQSMessage();
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

// * processVideo function in SQS Queue Worker
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
                QueueUrl:
                  "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
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

module.exports = app;
