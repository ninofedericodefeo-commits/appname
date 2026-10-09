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

export async function describeLocation(coordinates: { latitude: number; longitude: number }) {
  const [place] = await Location.reverseGeocodeAsync(coordinates);
  if (!place) return { name: 'Name not listed', address: '' };
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
  const address = place.formattedAddress || [street, place.city, place.region, place.postalCode].filter(Boolean).join(', ');
  return { name: place.name?.trim() || 'Name not listed', address };
}

export async function geocodeDestination(address: string) {
  if (Platform.OS === 'web') throw new Error('Address lookup is available in the iPhone or Android app. Enter destination coordinates in this preview.');
  let results: Location.LocationGeocodedLocation[];
  try { results = await Location.geocodeAsync(address); }
  catch { throw new Error('Destination address lookup is unavailable. Try again, or enter latitude, longitude instead.'); }
  const [result] = results;
  if (!result) throw new Error('Destination not found. Try a fuller address or coordinates.');
  return { latitude: result.latitude, longitude: result.longitude };
}
