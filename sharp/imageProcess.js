const sharp = require("sharp");

const processImage = async function (image, width, height, quality) {
  try {
    const resizedImage = await sharp(image)
      .resize(width, height)
      .jpeg({ quality: quality })
      .toBuffer();
    return resizedImage;
  } catch (err) {
    console.error("Error processing image:", err);
    return null;
  }
};

module.exports = { processImage };
