// Meteo temps reel (Open-Meteo) : elle alimente le scoring, une option velo
// perdant de l'interet sous la pluie ou le vent fort.
import type { WeatherSignal } from '../../../types';

export const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=45.7578&longitude=4.832&current=temperature_2m,wind_speed_10m,precipitation,weather_code';

// Perimetre produit: toute la metropole de Lyon (Velo'v couvre Lyon/Villeurbanne,
// Dott et TCL debordent sur les communes limitrophes).

export interface OpenMeteoCurrent {
  temperature_2m: number;
  wind_speed_10m: number;
  precipitation: number;
  weather_code: number;
  time: string;
}

export function weatherFromOpenMeteo(current: OpenMeteoCurrent): WeatherSignal {
  let condition: WeatherSignal['condition'] = 'clear';
  if (current.precipitation >= 2.5) {
    condition = 'heavy_rain';
  } else if (current.precipitation > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(current.weather_code)) {
    condition = 'light_rain';
  } else if (current.wind_speed_10m >= 30) {
    condition = 'wind';
  }

  return {
    condition,
    temperature_celsius: Math.round(current.temperature_2m),
    wind_kmh: Math.round(current.wind_speed_10m),
    updated_at: current.time,
  };
}
