import type { SafeClientConfig } from '$lib/types';
import { privateConfig } from './private';
import { getAppConfig } from './app';
import packageJson from '../../../../package.json';

export const appVersion = packageJson.version;

export function getPublicConfig(): SafeClientConfig {
  return Object.freeze({
    appName: 'MapMe',
    appVersion,
    authMode: getAppConfig()?.authMode ?? 'none',
    tileUrl: privateConfig.tileProxyEnabled ? '/api/tiles/{z}/{x}/{y}' : privateConfig.tileUrl,
    tileAttribution: privateConfig.tileAttribution,
    tileMaxZoom: privateConfig.tileMaxZoom,
    tileProxyEnabled: privateConfig.tileProxyEnabled,
    geocodingEnabled: privateConfig.geocodingEnabled,
    geocodingAutocomplete: privateConfig.geocodingAutocomplete,
    uploadMaxFileSizeMb: privateConfig.uploadMaxFileSizeMb,
    uploadMaxFilesPerPlace: privateConfig.uploadMaxFilesPerPlace
  });
}
