import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  tokenUse: "id",
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
});

export async function verifyToken(token: string) {
  try {
    const payload = await verifier.verify(token);
    return {
      userId: payload.sub,
      email: payload.email?.toString(),
      name: payload.name?.toString() || (payload.given_name ? `${payload.given_name} ${payload.family_name || ''}`.trim() : payload.email?.toString())
    };
  } catch (err) {
    console.error("Token verification failed!", err);
    throw new Error("Unauthorized");
  }
}
