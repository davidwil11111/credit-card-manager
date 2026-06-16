import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.creditcard.steward.dev',
  appName: '信用卡管家-DEV',
  webDir: 'dist',
  android: {
    captureInput: true,
    webContentsDebuggingEnabled: true,
    allowMixedContent: true,
    backgroundColor: '#1d4ed8'
  },
  ios: {
    scheme: 'creditcardstewarddev',
    contentInset: 'always'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
