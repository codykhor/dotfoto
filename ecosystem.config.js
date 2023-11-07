module.exports = {
  apps: [
    {
      name: "dotmedia",
      script: "./bin/www",
    },
    {
      name: "aws-worker",
      script: "./aws/awsWorker.js",
    },
  ],
};
