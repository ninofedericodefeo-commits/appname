import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';

import '@/features/trip-planning/backgroundFuelTracking';
import { queryClient } from '@/lib/queryClient';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </QueryClientProvider>
  );
}
