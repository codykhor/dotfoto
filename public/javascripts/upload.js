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
      const uploadURL = data.presignedURL;

      const fileInput = document.getElementById("myFile");
      const file = fileInput.files[0];

      const width = formData.get("width");
      const height = formData.get("height");
      const filename = file.name;

      const uploadResponse = await fetch(uploadURL, {
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
