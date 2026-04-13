import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AudioPlayerProvider } from '../contexts/AudioPlayerContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ProfileProvider, useProfile } from '../contexts/ProfileContext';
import { View, ActivityIndicator, Platform } from 'react-native';
import { Colors } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
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
      { name: 'Bookerly',     file: '/fonts/Bookerly.ttf',                       bold: '/fonts/Bookerly Bold.ttf',             fmt: 'truetype' },
      { name: 'Caroni',       file: '/fonts/Caroni-Regular.otf',                 bold: null,                                   fmt: 'opentype' },
    ];

    const style = document.createElement('style');
    style.textContent = selfHosted.map(({ name, file, bold, fmt }) => [
      `@font-face { font-family: '${name}'; src: local('${name}'), url('${file}') format('${fmt}'); font-weight: normal; font-style: normal; }`,
      bold ? `@font-face { font-family: '${name}'; src: local('${name}'), url('${bold}') format('${fmt}'); font-weight: bold; font-style: normal; }` : '',
    ].join('\n')).join('\n');
    document.head.appendChild(style);
  }, []);

  // 2. INITIALIZATION (Runs once on mount)
  // Note: API initialization is handled by AuthContext (with proxy already enabled).
  // This just signals the root layout is ready to render.
  useEffect(() => {
    setIsReady(true);
  }, []);


  // 4. LOADING SPINNER
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
      <ProfileProvider>
      <AuthProvider>
        <AudioPlayerProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </AudioPlayerProvider>
      </AuthProvider>
      </ProfileProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// 5. INNER NAVIGATION (Handles the actual Stack)
function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // 3. NAVIGATION GUARD (Bypass/Login Redirects)
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // Allow navigation if authenticated OR if a profile is selected
    const canAccessApp = isAuthenticated || !!activeProfile;

    console.log('[NavGuard] Checking:', { isAuthenticated, hasProfile: !!activeProfile, inAuthGroup, segments });

    if (!canAccessApp && !inAuthGroup) {
      console.log('[NavGuard] Redirecting to login');
      router.replace('/(auth)/login');
    } else if (canAccessApp && inAuthGroup) {
      console.log('[NavGuard] Redirecting to tabs');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, activeProfile]);

  return (
    <View style={{ flex: 1, height: '100vh', backgroundColor: colors.background }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
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
        {/* Root-level audiobook player so navigating to it from the epub modal
            pushes onto the root stack — back() returns to the epub instead of home */}
        <Stack.Screen
          name="audiobook/[id]"
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
      </Stack>
      <MiniPlayer />
    </View>
  );
}