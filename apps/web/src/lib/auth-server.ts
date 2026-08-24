import { CognitoJwtVerifier } from "aws-jwt-verify";

const globalForAuth = globalThis as unknown as {
  verifier: any;
};

export async function verifyToken(token: string) {
  if (!globalForAuth.verifier) {
    if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
      console.warn("WARNING: NEXT_PUBLIC_COGNITO_USER_POOL_ID is undefined. Please restart your Next.js dev server!");
    }
    globalForAuth.verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "ap-south-1_MIfl6nhaK",
      tokenUse: "id",
      clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "300n0vkp6c1j0btr95rgub32rr",
    });
  }

  try {
    const payload = await globalForAuth.verifier.verify(token);
    return {
      userId: payload.sub,
      email: payload.email?.toString(),
      name: payload.name?.toString() || (payload.given_name ? `${payload.given_name} ${payload.family_name || ''}`.trim() : payload.email?.toString())
    };
  } catch (err: any) {
    console.error("Token verification failed!", err);
    throw new Error(`Unauthorized: ${err.message}`);
  }
}
