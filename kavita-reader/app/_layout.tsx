import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AudioPlayerProvider } from '../contexts/AudioPlayerContext';
import { View, ActivityIndicator } from 'react-native';
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

  // 2. INITIALIZATION (Runs once on mount)
  useEffect(() => {
  const bootApp = async () => {
    try {
      // 1. Initialize APIs
      await kavitaAPI.initialize();
      await absAPI.initialize();

      // 2. Explicitly check .env variables to set the flag
      // Make sure these match your .env keys EXACTLY
      const hasKavitaEnv = !!(process.env.EXPO_PUBLIC_KAVITA_URL && process.env.EXPO_PUBLIC_KAVITA_API_KEY);
      const hasAbsEnv = !!(process.env.EXPO_PUBLIC_ABS_URL && process.env.EXPO_PUBLIC_ABS_TOKEN);

      // 3. Update the state that controls the redirect
      if (hasKavitaEnv || hasAbsEnv) {
        setShowLogin(false);
      } else {
        // Fallback: Check storage if no .env is found
        const hasStored = await storage.getItem('kavita_server_url');
        if (hasStored) setShowLogin(false);
      }
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
      <AuthProvider>
        <AudioPlayerProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
          <PWAInstallBanner />
        </AudioPlayerProvider>
      </AuthProvider>
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