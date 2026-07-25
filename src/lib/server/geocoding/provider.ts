export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
  type: string | null;
}

export interface GeocodingProvider {
  forward(query: string): Promise<GeocodingResult[]>;
  reverse(latitude: number, longitude: number): Promise<GeocodingResult[]>;
}
