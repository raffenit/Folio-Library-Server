import { Stack } from 'expo-router';

export default function ReaderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="epub" />
      <Stack.Screen name="pdf" />
      <Stack.Screen name="image" />
    </Stack>
  );
}
