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

      const width = formData.get("width");
      const height = formData.get("height");

      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (uploadResponse.status === 200) {
        console.log("File uploaded successfully!");
        window.location.href = `/download?name=${filename}&width=${width}&height=${height}`;
      } else {
        console.log("Error uploading file.");
      }
    } else {
      console.log("Error generating pre-signed URL.");
    }
  });

function validateFileSize(fileInput) {
  const maxFileSize = 30 * 1024 * 1024; // 30MB

  if (fileInput.files[0].size > maxFileSize) {
    alert("File must be less than 30MB.");
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
