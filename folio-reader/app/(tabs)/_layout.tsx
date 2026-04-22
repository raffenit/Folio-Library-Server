import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { View, Platform } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

// Visible tabs in order for swipe navigation
const VISIBLE_TABS = ['index', 'audiobooks', 'search', 'profile', 'settings'];

// Custom translucent tab bar background for web
function TranslucentTabBarBackground() {
  const { colors } = useTheme();
  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.surface + 'E6',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      />
    );
  }
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: colors.surface + 'DD',
      }}
    />
  );
}

function SwipeableTabs({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const translateX = useSharedValue(0);

  if (Platform.OS !== 'web') {
    // On mobile, use gesture handler
    const gesture = Gesture.Pan()
      .onBegin(() => {
        translateX.value = 0;
      })
      .onUpdate((e) => {
        translateX.value = e.translationX;
      })
      .onEnd((e) => {
        const SWIPE_THRESHOLD = 50;
        const velocity = e.velocityX;
        const translation = e.translationX;

        // Get current tab from pathname - only for visible tabs, ignore nested routes
        const pathParts = pathname?.split('/').filter(Boolean) || [];
        const currentTab = pathParts[1] || 'index';
        const currentIndex = VISIBLE_TABS.indexOf(currentTab);

        // Only handle swipe for visible tabs, ignore nested routes like series/[id]
        if (currentIndex === -1) return;

        // Swipe left (negative translation) -> go to next tab (right)
        if (translation < -SWIPE_THRESHOLD || velocity < -500) {
          const nextIndex = currentIndex + 1;
          if (nextIndex < VISIBLE_TABS.length) {
            router.push(`/(tabs)/${VISIBLE_TABS[nextIndex]}` as any);
          }
        }
        // Swipe right (positive translation) -> go to previous tab (left)
        else if (translation > SWIPE_THRESHOLD || velocity > 500) {
          const prevIndex = currentIndex - 1;
          if (prevIndex >= 0) {
            router.push(`/(tabs)/${VISIBLE_TABS[prevIndex]}` as any);
          }
        }
      });

    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={gesture}>
          <View style={{ flex: 1 }}>{children}</View>
        </GestureDetector>
      </GestureHandlerRootView>
    );
  }

  // On web, return children directly (swipe not supported as well)
  return <>{children}</>;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <SwipeableTabs>
      <Tabs
      screenOptions={{
        headerShown: false,
        sceneContainerStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 58,
          paddingBottom: 8,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          elevation: 0,
        },
        tabBarBackground: () => <TranslucentTabBarBackground />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        // Slide animation between tabs like turning pages
        animation: 'shift',
        animationDuration: 300,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'EBooks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="audiobooks"
        options={{
          title: 'Audiobooks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="headset" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      {/* Hidden tabs — files kept for router compatibility */}
      <Tabs.Screen name="ebooks" options={{ href: null }} />
      <Tabs.Screen name="libraries" options={{ href: null }} />
      <Tabs.Screen name="collections" options={{ href: null }} />
      <Tabs.Screen name="browse" options={{ href: null }} />
      <Tabs.Screen name="audiobook" options={{ href: null }} />
      <Tabs.Screen name="audiobook/[id]" options={{ href: null }} />
      <Tabs.Screen name="series" options={{ href: null }} />
      <Tabs.Screen name="series/[id]" options={{ href: null }} />
    </Tabs>
    </SwipeableTabs>
  );
}
