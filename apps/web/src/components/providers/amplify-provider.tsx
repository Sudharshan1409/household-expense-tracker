"use client";

import { Amplify } from "aws-amplify";
import 'aws-amplify/auth/enable-oauth-listener';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "ap-south-1_MIfl6nhaK",
      userPoolClientId: "300n0vkp6c1j0btr95rgub32rr",
      loginWith: {
        oauth: {
          domain: "household-expense-tracker-dev-157943428055.auth.ap-south-1.amazoncognito.com",
          scopes: ["email", "profile", "openid"],
          redirectSignIn: ["http://localhost:3000/"],
          redirectSignOut: ["http://localhost:3000/"],
          responseType: "code",
        },
      },
    },
  },
});

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
