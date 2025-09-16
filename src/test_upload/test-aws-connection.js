const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

console.log("🔍 Test de connexion AWS S3...");
console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...` : "NON DÉFINI");
console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? `${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 8)}...` : "NON DÉFINI");
console.log("AWS_REGION:", process.env.AWS_REGION);

const s3 = new S3Client({ 
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testConnection() {
  try {
    console.log("\n🚀 Test de listage des buckets...");
    const command = new ListBucketsCommand({});
    const response = await s3.send(command);
    
    console.log("✅ Connexion réussie!");
    console.log("📦 Buckets disponibles:");
    response.Buckets.forEach(bucket => {
      console.log(`  - ${bucket.Name}`);
    });
    
    // Vérifier si notre bucket existe
    const targetBucket = "bricolaltd-assets";
    const bucketExists = response.Buckets.some(bucket => bucket.Name === targetBucket);
    console.log(`\n🎯 Bucket '${targetBucket}': ${bucketExists ? '✅ TROUVÉ' : '❌ NON TROUVÉ'}`);
    
  } catch (error) {
    console.error("❌ Erreur de connexion:", error.message);
    if (error.Code) {
      console.error("Code d'erreur:", error.Code);
    }
  }
}

testConnection();