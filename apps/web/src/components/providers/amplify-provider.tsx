"use client";

import { Amplify } from "aws-amplify";
import 'aws-amplify/auth/enable-oauth-listener';
import { App as CapacitorApp } from '@capacitor/app';

if (typeof window !== 'undefined') {
  CapacitorApp.addListener('appUrlOpen', (event) => {
    // If we receive an OAuth callback (code= or error=)
    if (event.url.includes('code=') || event.url.includes('error=')) {
      // Force the webview to navigate to the url so Amplify can parse it
      window.location.href = event.url;
    }
  });

  // Smart Auto-Refresh: Trigger SWR to re-fetch when the app comes back from the background
  CapacitorApp.addListener('appStateChange', (state) => {
    if (state.isActive) {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('visibilitychange'));
    }
  });
}

const redirectUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/`
    : "http://localhost:3000/";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
          scopes: ["email", "profile", "openid"],
          redirectSignIn: [redirectUrl, "http://localhost:3000/"],
          redirectSignOut: [redirectUrl, "http://localhost:3000/"],
          responseType: "code",
        },
      },
    },
  },
});

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
