import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kana.furigana",
  appName: "KANA",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
