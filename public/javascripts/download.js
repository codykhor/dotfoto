document
  .getElementById("download-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    const loadingElement = document.getElementById("loading-message");
    const filename = this.querySelector('[name="filename"]').value;

    // Verify that the file name is provided
    if (!filename) {
      alert("Please provide a filename.");
      return;
    }

    // Show loading messages
    loadingElement.style.display = "block";

    try {
      await pollForFileAvailability(filename);
      await initiateFileDownload(filename);
      // Hide loading messages after file download is ready
      loadingElement.style.display = "none";
    } catch (error) {
      alert(error.message);
      // Hide loading message when error occurs
      loadingElement.style.display = "none";
    }
  });

// Check file readiness
async function pollForFileAvailability(filename) {
  const pollInterval = 5000; // Polling every 5 seconds
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const checkResponse = await fetch(
          `/download/check-file?name=${filename}`
        );
        console.log("Polling for file...");
        if (checkResponse.status === 200) {
          clearInterval(interval);
          resolve();
        }
      } catch (error) {
        clearInterval(interval);
        reject(new Error("An error occurred while checking the file."));
      }
    }, pollInterval);
  });
}

// Start downloading files
async function initiateFileDownload(filename) {
  const response = await fetch("/download/transfer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename }),
  });

  if (response.status !== 200) {
    throw new Error("Download failed. Please try again.");
  }

  const data = await response.json();
  const downloadLink = document.getElementById("download-link");
  downloadLink.href = data.downloadURL;
  downloadLink.click();
}
