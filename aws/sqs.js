const AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: "ap-southeast-2",
});

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

let sendParams = {
  MessageBody: messageBody,
  QueueUrl: "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
};

sqs.sendMessage(sendParams, function (err, data) {
  if (err) {
    console.log("Send Error", err);
  } else {
    console.log("Success", data.MessageId);
  }
});

let receiveParams = {
  QueueUrl: "https://sqs.ap-southeast-2.amazonaws.com/901444280953/dot-queue",
  MaxNumberOfMessages: 10, // you can specify up to 10
  VisibilityTimeout: 60, // time duration during which SQS prevents other consuming components from receiving and processing the message
  WaitTimeSeconds: 5, // long polling setting, 0 for short polling
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

module.exports = {
  sendMessage: sqs.sendMessage,
  receiveMessage: sqs.receiveMessage,
};
