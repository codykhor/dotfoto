const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const localFilePath = "/Users/codykhor/Downloads/example_1.mov";
const MAX = 5;

const runRequests = async () => {
  for (let i = 0; i < MAX; i++) {
    try {
      const formData = new FormData();
      formData.append(
        "file",
        fs.createReadStream("/Users/codykhor/Downloads/example_1.mov")
      );

      const response = await axios.post(
        "http://3.26.70.73:3000/upload",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

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

          // go to download page
          const downloadResponse = await axios.get(
            `http://3.26.70.73:3000/download?name=${filename}`
          );
          if (downloadResponse.status === 200) {
            console.log("Download request successful");
          } else {
            console.log("Error in download request");
          }
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
  }
};

runRequests();
