const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const baseURL =
  "http://dotmedia-lb-app-1231012212.ap-southeast-2.elb.amazonaws.com";
const localFilePath = "/Users/codykhor/Downloads/exp.mov";
const MAX = 10;

const runRequests = async () => {
  const promises = [];
  const delay = 2000;

  for (let i = 0; i < MAX; i++) {
    start = performance.now();
    const promise = (async () => {
      try {
        const formData = new FormData();
        formData.append("file", fs.createReadStream(`${localFilePath}`));

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

            // go to download page
            const downloadResponse = await axios.get(
              `${baseURL}/download?name=${filename}`
            );
            if (downloadResponse.status === 200) {
              console.log("Download request successful");
            } else {
              console.log("Error in download request");
            }

            // log time elapsed
            end = performance.now();
            elapsed = (end - start) / 1000; //convert to seconds
            console.log("Elapsed time in seconds: ", elapsed);
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
    if (i < MAX - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  await Promise.all(promises);
};

runRequests();
