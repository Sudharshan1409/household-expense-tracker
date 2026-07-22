"use server";

import { verifyToken } from "@/lib/auth-server";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "crypto";

const s3 = new S3Client({});

export async function getUploadPresignedUrl(idToken: string, householdId: string, filename: string, contentType: string) {
  const user = await verifyToken(idToken);
  
  const bucketName = process.env.NEXT_PUBLIC_RECEIPT_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing NEXT_PUBLIC_RECEIPT_BUCKET_NAME in environment variables");
  }

  // Create a safe, unique object key: householdId/userId/uuid-filename
  const ext = filename.split('.').pop() || "jpg";
  const uniqueId = crypto.randomUUID();
  const safeFilename = `${uniqueId}.${ext}`;
  const key = `receipts/${householdId}/${user.userId}/${safeFilename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  // URL expires in 60 seconds
  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

  return {
    uploadUrl: presignedUrl,
    fileKey: key,
    publicUrl: `https://${bucketName}.s3.amazonaws.com/${key}`,
  };
}

export async function getDownloadPresignedUrl(idToken: string, fileUrl: string) {
  const user = await verifyToken(idToken); // Ensure user is authenticated
  
  const bucketName = process.env.NEXT_PUBLIC_RECEIPT_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing NEXT_PUBLIC_RECEIPT_BUCKET_NAME");
  }

  // Extract the object key from the full URL
  // e.g. https://bucket.s3.amazonaws.com/receipts/123/456/uuid.jpg -> receipts/123/456/uuid.jpg
  const bucketDomain = `${bucketName}.s3.amazonaws.com/`;
  if (!fileUrl.includes(bucketDomain) && !fileUrl.includes('.amazonaws.com/')) {
    // If it's already some other public url or doesn't match our S3, just return it
    return fileUrl;
  }
  
  // Extract key by taking everything after .amazonaws.com/
  const key = fileUrl.split('.amazonaws.com/')[1];
  if (!key) return fileUrl;

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  // URL expires in 5 minutes
  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  return presignedUrl;
}
