import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.creditcard.steward',
  appName: '信用卡管家',
  webDir: 'dist',
  android: {
    captureInput: true,
    webContentsDebuggingEnabled: true,
    allowMixedContent: true,
    backgroundColor: '#1d4ed8'
  },
  ios: {
    scheme: 'creditcardsteward',
    contentInset: 'always'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
