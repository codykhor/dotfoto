document
  .getElementById("download-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const filename = this.querySelector('[name="filename"]').value;
    console.log(filename);

    // Generate pre-signed URL for download
    const response = await fetch("/download/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filename }),
    });

    if (response.status === 200) {
      const data = await response.json();
      const downloadURL = data.downloadURL;
      console.log(downloadURL);

      // Start polling for file availability
      const pollInterval = setInterval(async () => {
        const checkResponse = await fetch(`/check-file?name=${filename}`);
        if (checkResponse.status === 200) {
          clearInterval(pollInterval);
          // Download process for converted video
          const downloadLink = document.getElementById("download-link");
          downloadLink.href = downloadURL;
          downloadLink.click();
        }
      }, 5000); // Poll every 5 seconds
    } else {
      // Handle error
      console.error("Download failed");
    }
  });
