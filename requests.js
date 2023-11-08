const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const baseURL =
  "http://dotmedia-lb-app-1231012212.ap-southeast-2.elb.amazonaws.com";
const localFilePath = "/Users/arinning/Desktop/ASG1.mov";
const MAX = 100;

const runRequests = async () => {
  const promises = [];
  for (let i = 0; i < MAX; i++) {
    const promise = (async () => {
      try {
        const formData = new FormData();
        formData.append(
          "file",
          fs.createReadStream("/Users/arinning/Desktop/ASG1.mov")
        );

        const response = await axios.post(`${baseURL}/upload`, formData, {
          headers: {
            ...formData.getHeaders(),
          },
        });

        if (response.status === 200) {
          const data = response.data;
          const upload_url = data.presignedURL;
          const filename = data.newFileName;

          const videoData = fs.readFileSync(localFilePath);

          const uploadResponse = await axios.put(upload_url, videoData, {
            headers: {
              "Content-Type": "video/quicktime",
            },
          });

          if (uploadResponse.status === 200) {
            console.log("File uploaded successfully to S3!");

            // Send the SQS message here
            const sqsResponse = await axios.post(
              `${baseURL}/send-sqs-message`,
              {
                filename: filename,
              }
            );

            if (sqsResponse.status === 200) {
              console.log("SQS message sent successfully!");
            } else {
              console.log("Error sending SQS message.");
            }

            // // go to download page
            // const downloadResponse = await axios.get(
            //   `${baseURL}/download?name=${filename}`
            // );
            // if (downloadResponse.status === 200) {
            //   console.log("Download request successful");
            // } else {
            //   console.log("Error in download request");
            // }
          } else {
            console.log("Error uploading file.");
          }
        } else {
          console.log("Error uploading to S3)");
        }
      } catch (error) {
        if (error.response) {
          console.error(
            `Error in request. Status Code: ${error.response.status}, Response Data:`,
            error.response.data
          );
        } else {
          console.error("Error in request:", error.message);
        }
      }
      promises.push(promise);
    })();
  }
  await Promise.all(promises);
};

runRequests();
