export interface CategoryDTO {
  id: string;
  name: string;
  iconName: string;
  iconSvg: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  placeCount?: number;
}

export interface PlaceListDTO {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  placeCount?: number;
}

export interface PlaceLinkDTO {
  id: string;
  title: string | null;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface PlaceLinkInput {
  title?: string | null;
  url: string;
}

export interface AttachmentDTO {
  id: string;
  originalName: string;
  mediaType: string;
  sizeBytes: number;
  width: number;
  height: number;
  sortOrder: number;
  createdAt: string;
  thumbnailUrl: string;
  originalUrl: string;
}

export interface PlaceInput {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  description?: string | null;
  categoryId: string;
  listId: string;
  isFavorite: boolean;
  isArchived: boolean;
  rating?: number | null;
  dateVisited?: string | null;
  links?: PlaceLinkInput[];
  extraProperties?: Record<string, unknown>;
}

export interface PlaceSummary {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  category: CategoryDTO;
  list: PlaceListDTO;
  isFavorite: boolean;
  isArchived: boolean;
  rating: number | null;
  dateVisited: string | null;
  updatedAt: string;
  attachmentCount: number;
}

export interface PlaceDetail extends PlaceSummary {
  description: string | null;
  links: PlaceLinkDTO[];
  extraProperties: Record<string, unknown>;
  createdAt: string;
  attachments: AttachmentDTO[];
}

export interface MapPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isFavorite: boolean;
  isArchived: boolean;
  category: Pick<CategoryDTO, 'id' | 'name' | 'color' | 'iconName' | 'iconSvg'>;
}

export interface PlaceFilters {
  query: string;
  listIds: string[];
  categoryIds: string[];
  favorite: boolean | null;
  archived: boolean;
  ratingMin: number | null;
  sort: 'updated_desc' | 'name_asc' | 'rating_desc';
}

export interface SafeClientConfig {
  appName: string;
  appVersion: string;
  authMode: 'none' | 'password' | 'proxy';
  tileUrl: string;
  tileAttribution: string;
  tileMaxZoom: number;
  tileProxyEnabled: boolean;
  geocodingEnabled: boolean;
  geocodingAutocomplete: boolean;
  uploadMaxFileSizeMb: number;
  uploadMaxFilesPerPlace: number;
}

export interface ImportRecordResult {
  index: number;
  sourceLabel: string;
  valid: boolean;
  warnings: string[];
  errors: string[];
  duplicateOf?: { id: string; name: string; reason: string };
  place?: PlaceInput;
}

export interface ImportPreview {
  token: string;
  format: 'geojson' | 'csv' | 'kml' | 'gpx';
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  records: ImportRecordResult[];
  expiresAt: string;
}

export interface BackupManifest {
  formatVersion: 1;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  database: { path: 'database.sqlite'; size: number; sha256: string };
  uploads: Array<{ path: string; size: number; sha256: string }>;
  attachmentCount: number;
}
