import type { SafeClientConfig } from '$lib/types';
import { privateConfig } from './private';
import packageJson from '../../../../package.json';

export const publicConfig: SafeClientConfig = Object.freeze({
  appName: 'MapMe',
  appVersion: packageJson.version,
  authMode: privateConfig.authMode,
  tileUrl: privateConfig.tileUrl,
  tileAttribution: privateConfig.tileAttribution,
  tileMaxZoom: privateConfig.tileMaxZoom,
  geocodingEnabled: privateConfig.geocodingEnabled,
  geocodingAutocomplete: privateConfig.geocodingAutocomplete,
  uploadMaxFileSizeMb: privateConfig.uploadMaxFileSizeMb,
  uploadMaxFilesPerPlace: privateConfig.uploadMaxFilesPerPlace
});
