import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    global: 'window',
    __DEV__: JSON.stringify(mode === 'development'),
    'process.env': '{}',
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || 'https://zruonfdnfvgmaebanvdm.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydW9uZmRuZnZnbWFlYmFudmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTczODksImV4cCI6MjA5MjU5MzM4OX0.AfutlmSt6ix8TNm0Lc70P2R2U554CXSaa7DxPyY8Hz4'),
    'import.meta.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zruonfdnfvgmaebanvdm.supabase.co'),
    'import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydW9uZmRuZnZnbWFlYmFudmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTczODksImV4cCI6MjA5MjU5MzM4OX0.AfutlmSt6ix8TNm0Lc70P2R2U554CXSaa7DxPyY8Hz4'),
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'ClinLab AI Assistant',
        short_name: 'ClinLab',
        description: 'Advanced AI Assistant for Dental Clinics',
        theme_color: '#0EA5E9',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'assets-cache',
            },
          },
          {
            urlPattern: /\.(?:png|ico|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
            },
          },
        ],
      }
    })
  ].filter(Boolean),
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'],
    alias: {
      "react-native/Libraries/Utilities/codegenNativeComponent": path.resolve(__dirname, "./src/lib/codegenShim.ts"),
      "react-native/Libraries/Renderer/shims/ReactNative": path.resolve(__dirname, "./src/lib/reactNativeShim.ts"),
      "react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry": path.resolve(__dirname, "./src/lib/reactNativeViewConfigShim.ts"),
      "react-native/Libraries/Pressability/PressabilityDebug": path.resolve(__dirname, "./src/lib/codegenShim.ts"),
      "react-native-web/Libraries/Utilities/codegenNativeComponent": path.resolve(__dirname, "./src/lib/codegenShim.ts"),
      "react-native-web/Libraries/Renderer/shims/ReactNative": path.resolve(__dirname, "./src/lib/reactNativeShim.ts"),
      "react-native-web/Libraries/Renderer/shims/ReactNativeViewConfigRegistry": path.resolve(__dirname, "./src/lib/reactNativeViewConfigShim.ts"),
      "react-native-web/Libraries/Pressability/PressabilityDebug": path.resolve(__dirname, "./src/lib/codegenShim.ts"),
      "@": path.resolve(__dirname, "./src"),
      "react-native": "react-native-web",
      "expo-notifications": path.resolve(__dirname, "./src/lib/expo-mock.ts"),
      "expo-device": path.resolve(__dirname, "./src/lib/expo-mock.ts"),
      "expo-modules-core": path.resolve(__dirname, "./src/lib/expo-mock.ts"),
      "expo-document-picker": path.resolve(__dirname, "./src/lib/expo-document-picker-mock.ts"),
      "react-native-url-polyfill/auto": path.resolve(__dirname, "./src/lib/url-polyfill-mock.ts"),
      "react-native-url-polyfill": path.resolve(__dirname, "./src/lib/url-polyfill-mock.ts"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  optimizeDeps: {
    include: [
      "lucide-react-native", 
      "react-native-web", 
      "react-native-safe-area-context", 
      "react-native-screens", 
      "@react-navigation/native", 
      "@react-navigation/stack",
      "expo",
      "expo-device",
      "expo-notifications",
      "expo-modules-core"
    ],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },
}));
