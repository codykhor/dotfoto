// const sharp = require("sharp");

// const processImage = async function (image, width, height, dpi) {
//   try {
//     const resizedImage = await sharp(image)
//       .resize(width, height)
//       .withMetadata({ density: dpi })
//       .toBuffer();
//     return resizedImage;
//   } catch (err) {
//     console.error("Error processing image:", err);
//     return null;
//   }
// };

// module.exports = { processImage };

const gm = require("gm");

const processImage = async function (
  inputPath,
  outputPath,
  width,
  height,
  dpi
) {
  return new Promise((resolve, reject) => {
    gm(inputPath)
      .resize(width, height)
      .density(dpi, dpi)
      .write(outputPath, (error) => {
        if (error) {
          console.error("Error processing image:", error);
          reject(error);
        } else {
          resolve(outputPath);
        }
      });
  });
};

module.exports = { processImage };
