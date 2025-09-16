const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const s3 = new S3Client({ 
  region: "eu-north-1",
  endpoint: `https://s3.eu-north-1.amazonaws.com`,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

async function testUpload() {
  try {
    const imagePath = path.join(__dirname, "img (1).jpg");
    const fileContent = fs.readFileSync(imagePath);

    const uploadParams = {
      Bucket: "bricolaltd-assets",
      Key: "tools/test-upload.jpg",
      Body: fileContent,
      ContentType: "image/jpeg",
    };

    console.log("🚀 Début de l'upload vers S3...");
    await s3.send(new PutObjectCommand(uploadParams));
    console.log("✅ Upload réussi : https://bricolaltd-assets.s3.eu-north-1.amazonaws.com/tools/test-upload.jpg");
  } catch (error) {
    console.error("❌ Erreur lors de l'upload:", error);
  }
}

testUpload();