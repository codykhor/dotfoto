const AWS = require("aws-sdk");
require("dotenv").config();

const sqs = new AWS.SQS({ region: "ap-southeast-2", apiVersion: "2012-11-05" });
const queueName = "dot-queue";
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

function receiveSQSMessage() {
  let receiveParams = {
    QueueUrl: "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 60,
    WaitTimeSeconds: 5,
  };

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

module.exports = {
  sendSQSMessage,
  receiveSQSMessage,
};
