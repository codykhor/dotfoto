const AWS = require("aws-sdk");
require("dotenv").config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  region: "ap-southeast-2",
});

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });
const queueName = "dot-queuetest";

async function sendSQSMessage(messageBodyString) {
  let queueUrl;

  try {
    // Try to get the URL of the existing queue
    const data = await sqs.getQueueUrl({ QueueName: queueName }).promise();
    queueUrl = data.QueueUrl;
    console.log("SQS queue retrieved successfully", queueName);
  } catch (error) {
    // create new queue if it doesn't exist
    if (error.code === "AWS.SimpleQueueService.NonExistentQueue") {
      const data = await sqs.createQueue({ QueueName: queueName }).promise();
      queueUrl = data.QueueUrl;
      console.log("SQS queue created successfully", queueName);
    } else {
      throw error;
    }
  }

  let sendParams = {
    MessageBody: messageBodyString,
    QueueUrl: queueUrl,
  };

  sqs.sendMessage(sendParams, function (err, data) {
    if (err) {
      console.log("Error sending SQS message", err);
    } else {
      console.log("SQS message sent successfully", data.MessageId);
    }
  });
}

module.exports = {
  sendSQSMessage,
};
