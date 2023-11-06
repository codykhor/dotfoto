document.getElementById("myFile").addEventListener("change", function () {
  validateFile();
  validateFileSize(this);
});

document
  .getElementById("upload-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(this);

    // Send POST request to /upload for pre-signed URL
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    if (response.status === 200) {
      const data = await response.json();
      const upload_url = data.presignedURL;
      const filename = data.newFileName;

      const fileInput = document.getElementById("myFile");
      const file = fileInput.files[0];

      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      // File upload is successful, now send the SQS message
      const sqsResponse = await fetch("/send-sqs-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filename: filename }),
      });
      if (uploadResponse.status === 200 && sqsResponse.status === 200) {
        console.log("File uploaded successfully!");
        window.location.href = `/download?name=${filename}`;
      } else {
        console.log("Error uploading file.");
      }
    } else {
      console.log("Error generating pre-signed URL.");
    }
  });

function validateFileSize(fileInput) {
  const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB

  if (fileInput.files[0].size > maxFileSize) {
    alert("File must be less than 10GB.");
    fileInput.value = "";
    return false;
  }
  return true;
}

function validateFile() {
  const fileInput = document.getElementById("myFile");
  const processButton = document.getElementById("process-button");

  if (fileInput.files.length > 0) {
    processButton.removeAttribute("disabled");
  } else {
    processButton.setAttribute("disabled", "true");
  }
}
