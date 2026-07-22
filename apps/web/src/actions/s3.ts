"use server";

import { verifyToken } from "@/lib/auth-server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
