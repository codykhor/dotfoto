document
  .getElementById("download-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();
    console.log("JavaScript file loaded");
    const filename = this.querySelector('[name="filename"]').value;
    console.log(this.querySelectorAll("[name]"));
    console.log("the filename is :", filename);

    if (filename) {
      // Start polling for file availability
      const pollInterval = setInterval(async () => {
        const checkResponse = await fetch(
          `/download/check-file?name=${filename}`
        );
        console.log("Polling...");
        if (checkResponse.status === 200) {
          clearInterval(pollInterval);
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

            // Download process for converted video
            const downloadLink = document.getElementById("download-link");
            downloadLink.href = downloadURL;
            downloadLink.click();
          } else {
            // Handle error
            console.error("Download failed");
          }
        }
      }, 5000); // Poll every 5 seconds
    } else {
      console.error("No filename provided");
    }
  });
