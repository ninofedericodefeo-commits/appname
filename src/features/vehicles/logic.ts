export type CarProfile = {
  id: string;
  name: string;
  model: string;
  mpg: number;
  tankGallons: number;
  estimateSource: string;
};

export function newCarId() { return `car-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// Conservative starting guesses by EPA vehicle class, not manufacturer tank specifications.
export function estimatedTankGallons(vehicleClass: string) {
  if (/Pickup|Standard Sport Utility|Van/i.test(vehicleClass)) return 20;
  if (/Small Sport Utility|Station Wagon|Large Cars/i.test(vehicleClass)) return 14;
  return 12;
}

export function validateCar(profile: CarProfile) {
  if (!profile.id || !profile.name.trim() || !profile.model.trim()) throw new Error('Give your car a name and model.');
  if (!Number.isFinite(profile.mpg) || profile.mpg < 5 || profile.mpg > 100) throw new Error('Enter estimated MPG between 5 and 100.');
  if (!Number.isFinite(profile.tankGallons) || profile.tankGallons < 2 || profile.tankGallons > 60) throw new Error('Enter tank capacity between 2 and 60 US gallons.');
  return { ...profile, name: profile.name.trim().slice(0, 80), model: profile.model.trim().slice(0, 100) };
}

export function fuelRange(profile: CarProfile, value: number, unit: 'percent' | 'gallons') {
  validateCar(profile);
  const max = unit === 'percent' ? 100 : profile.tankGallons;
  if (!Number.isFinite(value) || value <= 0 || value > max) throw new Error(`Enter ${unit === 'percent' ? 'a tank percentage from 1 to 100' : `gallons above 0 and no more than ${profile.tankGallons}`}.`);
  const gallons = unit === 'percent' ? profile.tankGallons * value / 100 : value;
  // Account for the uncertainty of a broad model estimate, weather and driving conditions.
  return { gallons, initialRange: gallons * profile.mpg * 0.85, fullRange: profile.tankGallons * profile.mpg * 0.85 };
}
