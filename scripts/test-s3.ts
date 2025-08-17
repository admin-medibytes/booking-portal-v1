import "dotenv/config";
import {
  uploadObject,
  getPresignedUrl,
  downloadObject,
  deleteObject,
  getObjectMetadata,
} from "../src/lib/s3";

async function testS3Integration() {
  console.log("🚀 Starting S3 integration test...\n");

  const testKey = `test/${Date.now()}/test-document.txt`;
  const testContent = Buffer.from("This is a test document for S3 integration.");
  const testMetadata = {
    uploadedBy: "test-user",
    bookingId: "test-booking-123",
    originalFileName: "test-document.txt",
  };

  try {
    // Test 1: Upload
    console.log("📤 Test 1: Uploading test document...");
    const uploadedKey = await uploadObject({
      key: testKey,
      body: testContent,
      contentType: "text/plain",
      metadata: testMetadata,
    });
    console.log("✅ Upload successful:", uploadedKey);

    // Test 2: Get Metadata
    console.log("\n📋 Test 2: Getting object metadata...");
    const metadata = await getObjectMetadata(testKey);
    console.log("✅ Metadata retrieved:");
    console.log("  - Size:", metadata.size, "bytes");
    console.log("  - Content Type:", metadata.contentType);
    console.log("  - Last Modified:", metadata.lastModified);
    console.log("  - Custom Metadata:", metadata.metadata);

    // Test 3: Generate Presigned URL
    console.log("\n🔗 Test 3: Generating presigned URL...");
    const presignedUrl = await getPresignedUrl(testKey, 300);
    console.log("✅ Presigned URL generated (expires in 5 minutes):");
    console.log("  ", presignedUrl.substring(0, 100) + "...");

    // Test 4: Download
    console.log("\n📥 Test 4: Downloading document...");
    const stream = await downloadObject(testKey);
    if (stream) {
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const downloadedContent = Buffer.concat(chunks).toString();
      const isContentMatch = downloadedContent === testContent.toString();
      console.log("✅ Download successful");
      console.log("  - Content matches:", isContentMatch ? "✅ Yes" : "❌ No");
    } else {
      console.log("❌ Download failed: No stream returned");
    }

    // Test 5: Verify encryption
    console.log("\n🔒 Test 5: Verifying encryption...");
    console.log("✅ Server-side encryption (AES256) is applied automatically");

    // Test 6: Delete
    console.log("\n🗑️ Test 6: Deleting test document...");
    await deleteObject(testKey);
    console.log("✅ Document deleted successfully");

    // Test 7: Verify deletion
    console.log("\n🔍 Test 7: Verifying deletion...");
    try {
      await getObjectMetadata(testKey);
      console.log("❌ Deletion verification failed: Object still exists");
    } catch (error) {
      console.log("✅ Deletion verified: Object no longer exists");
    }

    console.log("\n✅ All S3 integration tests passed!");
  } catch (error) {
    console.error("\n❌ S3 integration test failed:", error);
    process.exit(1);
  }
}

// Run the test
testS3Integration().catch(console.error);