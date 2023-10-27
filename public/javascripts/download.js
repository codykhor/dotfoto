document
  .getElementById("download-form")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const filename = this.querySelector('[name="filename"]').value;

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
    } else {
      // Handle error (e.g., show an error message)
      console.error("Download failed");
    }
  });
