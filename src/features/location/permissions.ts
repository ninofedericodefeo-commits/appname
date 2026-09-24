import * as Location from 'expo-location';
import { Platform } from 'react-native';

export async function requestLocationPermission() {
  if (Platform.OS === 'web') {
    return await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: false, timeout: 10000 },
      );
    });
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation() {
  if (Platform.OS === 'web') {
    return await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (error) => reject(new Error(error.message)),
        { enableHighAccuracy: false, timeout: 10000 },
      );
    });
  }

  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}
