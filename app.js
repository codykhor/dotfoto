require("dotenv").config();

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const AWS = require("aws-sdk");

var indexRouter = require("./routes/index");
var downloadRouter = require("./routes/download");

var app = express();

// AWS Configuration
AWS.config.update({
  region: "ap-southeast-2",
});

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
const s3 = new AWS.S3();

const bucketName = "dotfoto-image-s3";
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

// const expiryTime = 3600; // 1 hour

// Function to create S3 bucket if doesn't exist
const createS3bucket = () => {
  const params = {
    Bucket: bucketName,
  };

  s3.createBucket(params, (err, data) => {
    if (err) {
      if (err.statusCode === 409) {
        console.log(`Bucket already exists: ${bucketName}`);
      } else {
        console.log(`Error creating bucket: ${err}`);
      }
    } else {
      console.log(`Created bucket: ${bucketName}`);
    }
  });
};

// Create the S3 bucket when the application starts
createS3bucket();

// SQS servive section
function receiveSQSMessage() {
  let receiveParams = {
    QueueUrl: "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 60,
    WaitTimeSeconds: 5,
  };

  // SQS receive message from application
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

// Checks for new messages from application
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

async function processVideo(videoID, receiptHandle) {
  try {
    const downloadURL = generateGetUrl(videoID);
    const outputFileName = videoID.split(".").slice(0, -1).join(".");
    const outputPath = `${outputFileName}.mp4`;

    const ffmpegProcess = ffmpeg()
      .input(downloadURL)
      .audioCodec("copy")
      .output(outputPath)
      .outputFormat("mp4");

    console.log("FFmpeg command: " + ffmpegProcess.command);

    // Await the completion of the FFmpeg conversion
    await new Promise((resolve, reject) => {
      ffmpegProcess.on("end", () => resolve());
      ffmpegProcess.on("error", (err) => reject(err));
      ffmpegProcess.run();
    });

    const params = {
      Bucket: bucketName,
      Key: outputPath,
      Body: fs.createReadStream(outputPath),
    };

    // Await the S3 upload
    const s3Upload = await new Promise((resolve, reject) => {
      s3.upload(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    const deleteParams = {
      QueueUrl:
        "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
      ReceiptHandle: receiptHandle,
    };

    // Await the message deletion
    await new Promise((resolve, reject) => {
      sqs.deleteMessage(deleteParams, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    s3Upload
      .then(() => {
        return new Promise((resolve, reject) => {
          sqs.deleteMessage(deleteParams, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
      })
      .then(() => {
        // Remove local file
        fs.unlink(outputPath, (err) => {
          if (err) {
            console.error("Error removing local file:", err);
          } else {
            console.log("Local file removed successfully");
          }
        });
      });

    return outputPath; // Resolve the Promise with the output path
  } catch (err) {
    console.error("Error processing video:", err);
    throw err;
  }
}

module.exports = app;
