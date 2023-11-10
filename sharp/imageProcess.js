const sharp = require("sharp");

const processImage = async function (image, width, height, dpi) {
  try {
    const resizedImage = await sharp(image)
      .resize(width, height)
      .withMetadata({ density: dpi })
      .toBuffer();
    return resizedImage;
  } catch (err) {
    console.error("Error processing image:", err);
    return null;
  }
};

module.exports = { processImage };
