import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.household.tracker',
  appName: 'Household Tracker',
  webDir: 'out',
  server: {
    url: 'https://household-expense-tracker-web.vercel.app',
    cleartext: false
  }
};

export default config;
