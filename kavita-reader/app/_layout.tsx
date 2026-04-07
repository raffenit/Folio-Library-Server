import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AudioPlayerProvider } from '../contexts/AudioPlayerContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Colors } from '../constants/theme';
import { PWAInstallBanner } from '../components/PWAInstallBanner';
import { MiniPlayer } from '../components/MiniPlayer';
import { kavitaAPI } from '../services/kavitaAPI';
import { absAPI } from '../services/audiobookshelfAPI';
import { useState, useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { storage } from '../services/storage';

export default function RootLayout() {
  // 1. STATES MUST BE INSIDE THE COMPONENT
  const [isReady, setIsReady] = useState(false);
  const [showLogin, setShowLogin] = useState(true);

  const segments = useSegments();
  const router = useRouter();

  // Inject fonts on web startup.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // 1. Google Fonts (Libre Baskerville, Roboto, Poppins, Mulish)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' +
      'family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&' +
      'family=Roboto:wght@400;500;700&' +
      'family=Poppins:wght@400;500;600;700&' +
      'family=Mulish:wght@400;500;700&' +
      'display=swap';
    document.head.appendChild(link);

    // 2. Self-hosted fonts (file must exist in public/fonts/)
    const selfHosted = [
      { name: 'OpenDyslexic', file: '/fonts/OpenDyslexic-Regular.otf',          bold: '/fonts/OpenDyslexic-Bold.otf',         fmt: 'opentype' },
      { name: 'Bookerly',     file: '/fonts/Bookerly.ttf',                       bold: '/fonts/Bookerly-Bold.ttf',             fmt: 'truetype' },
      { name: 'Caroni',       file: '/fonts/Caroni-Regular.otf',                 bold: null,                                   fmt: 'opentype' },
    ];

    const style = document.createElement('style');
    style.textContent = selfHosted.map(({ name, file, bold, fmt }) => [
      `@font-face { font-family: '${name}'; src: url('${file}') format('${fmt}'); font-weight: normal; font-style: normal; }`,
      bold ? `@font-face { font-family: '${name}'; src: url('${bold}') format('${fmt}'); font-weight: bold; font-style: normal; }` : '',
    ].join('\n')).join('\n');
    document.head.appendChild(style);
  }, []);

  // 2. INITIALIZATION (Runs once on mount)
  useEffect(() => {
  const bootApp = async () => {
    try {
      // 1. Initialize APIs
      await kavitaAPI.initialize();
      await absAPI.initialize();

      const hasStored = await storage.getItem('kavita_server_url');
      if (hasStored) setShowLogin(false);
    } catch (e) {
      console.error("Boot error:", e);
    } finally {
      // 4. Only after EVERYTHING is set do we allow the app to render
      setIsReady(true);
    }
  };

  bootApp();
}, []);

  // 3. NAVIGATION GUARD (Bypass/Login Redirects)
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (showLogin && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (!showLogin && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isReady, showLogin, segments]);

  // 4. LOADING SPINNER
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d12' }}>
        <ActivityIndicator size="large" color="#e8a838" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
      <AuthProvider>
        <AudioPlayerProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
          <PWAInstallBanner />
        </AudioPlayerProvider>
      </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// 5. INNER NAVIGATION (Handles the actual Stack)
function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="reader/pdf"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="reader/epub"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="series/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="audiobook/[id]"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <MiniPlayer />
    </>
  );
}