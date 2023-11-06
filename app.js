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
AWS.config.update({
  region: "ap-southeast-2",
});
const { bucketName, s3 } = require("./aws/s3");
const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
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

// function processVideo(videoID, receiptHandle) {
//   return new Promise((resolve, reject) => {
//     // Generate pre-signed URL for download
//     try {
//       const downloadURL = generateGetUrl(videoID);

//       // Remove the file extension from the videoID for the output file
//       const outputFileName = videoID.split(".").slice(0, -1).join(".");
//       const outputPath = `${outputFileName}.mp4`;

//       const ffmpegProcess = ffmpeg()
//         .input(downloadURL) // Provide the presigned URL as the input
//         .audioCodec("copy")
//         .output(outputPath)
//         .outputFormat("mp4")
//         .on("start", function (commandLine) {
//           console.log("FFmpeg command: " + commandLine);
//         })
//         .on("progress", function (progress) {
//           console.log("Processing: " + progress.percent + "% done");
//         })
//         .on("end", async function () {
//           // Upload processed video to S3
//           try {
//             const params = {
//               Bucket: bucketName,
//               Key: outputPath,
//               Body: fs.createReadStream(outputPath),
//             };

//             const s3Upload = await new Promise((resolve, reject) => {
//               s3.upload(params, function (err, data) {
//                 if (err) {
//                   console.log("Error uploading video: ", err);
//                   reject(err);
//                 } else {
//                   console.log("Converted video upload successful!");
//                   resolve(data);
//                 }
//               });
//             });

//             const deleteParams = {
//               QueueUrl:
//                 "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
//               ReceiptHandle: receiptHandle,
//             };

//             sqs.deleteMessage(deleteParams, function (err, data) {
//               if (err) {
//                 console.log("Delete Error", err);
//                 reject(err);
//               } else {
//                 console.log("Message Deleted", data);

//                 // Remove local file
//                 fs.unlink(outputPath, (err) => {
//                   if (err) {
//                     console.error("Error removing local file:", err);
//                   } else {
//                     console.log("Local file removed successfully");
//                   }
//                 });
//               }
//               resolve(outputPath);
//             });
//           } catch (err) {
//             reject(err);
//           }
//         })
//         .on("error", function (err) {
//           console.error("Error converting video:", err.message);
//           console.error("ffmpeg stderr:", err.stderr);
//           reject(err);
//         });
//       ffmpegProcess.run();
//     } catch (err) {
//       console.log(err);
//       reject(err);
//     }
//   });
// }

// s3.upload(params, function (err, data) {
//   if (err) {
//     console.log("Error uploading video: ", err);
//     res.status(500).render("error", { err });
//   } else {
//     console.log("Converted video upload successful!");

// Delete the message from the SQS queue
// const deleteParams = {
//   QueueUrl:
//     "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
//   ReceiptHandle: receiptHandle,
// };

// sqs.deleteMessage(deleteParams, function (err, data) {
//   if (err) {
//     console.log("Delete Error", err);
//   } else {
//     console.log("Message Deleted", data);

//     // Remove local file
//     fs.unlink(outputPath, (err) => {
//       if (err) {
//         console.error("Error removing local file:", err);
//       } else {
//         console.log("Local file removed successfully");
//       }
//     });
//   }
// });
//               resolve(outputPath);
//             }
//           });
//         })
//         .on("error", function (err) {
//           console.error("Error converting video:", err.message);
//           console.error("ffmpeg stderr:", err.stderr);
//           reject(err);
//         });
//       ffmpegProcess.run();
//     } catch (err) {
//       console.log(err);
//       reject(err);
//     }
//   });
// }

module.exports = app;
