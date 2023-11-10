// Add change event listener to the file input
document.getElementById("myFile").addEventListener("change", function () {
  validateFile();
  validateFileSize(this);
});

// Add submit event listener to the upload form
document
  .getElementById("upload-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(this);

    // Attempt to get a pre-signed URL from the server
    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Error generating pre-signed URL");
      }

      const data = await response.json();
      const upload_url = data.presignedURL;
      const filename = data.newFileName;

      // Upload the file to the pre-signed URL
      await uploadFile(upload_url, filename);
    } catch (error) {
      console.error(error.message);
      alert("Failed to upload file.");
    }
  });

// Upload file to the provided pre-signed URL
async function uploadFile(upload_url, filename) {
  const fileInput = document.getElementById("myFile");
  const file = fileInput.files[0];

  try {
    const uploadResponse = await fetch(upload_url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error("Error uploading file");
    }

    console.log("File uploaded successfully!");
    // Send the SQS message after successful file upload
    await sendSQSMessage(filename);
    window.location.href = `/download?name=${filename}`;
  } catch (error) {
    console.error(error.message);
    alert("Failed to upload file.");
  }
}

// Send SQS message with the uploaded file's filename
async function sendSQSMessage(filename) {
  try {
    const sqsResponse = await fetch("/send-sqs-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename: filename }),
    });

    if (!sqsResponse.ok) {
      throw new Error("Error sending SQS message");
    }
  } catch (error) {
    console.error(error.message);
    alert("Failed to send SQS message.");
  }
}

// Validate file size
function validateFileSize(fileInput) {
  const maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB limit

  if (fileInput.files[0].size > maxFileSize) {
    alert("File must be less than 10GB.");
    fileInput.value = "";
    return false;
  }
  return true;
}

// Enable or disable the process button based on file input
function validateFile() {
  const fileInput = document.getElementById("myFile");
  const processButton = document.getElementById("process-button");

  processButton.disabled = fileInput.files.length === 0;
}
