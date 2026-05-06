import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.creditcard.manager',
  appName: '信用卡管理',
  webDir: 'dist',
  android: {
    captureInput: true,
    webContentsDebuggingEnabled: true,
    allowMixedContent: true,
    backgroundColor: '#1d4ed8'
  },
  ios: {
    scheme: 'creditcardmanager',
    contentInset: 'always'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
