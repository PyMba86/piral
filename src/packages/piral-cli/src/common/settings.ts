import { ParcelOptions } from 'parcel-bundler';
import { defaultCacheDir } from './info';

export interface ParcelConfig extends ParcelOptions {
  global?: string;
  autoInstall?: boolean;
}

export function extendConfig(options: ParcelConfig): ParcelConfig {
  return {
    cache: true,
    cacheDir: defaultCacheDir,
    contentHash: false,
    scopeHoist: false,
    target: 'browser',
    logLevel: 3,
    hmrPort: 0,
    sourceMaps: true,
    detailedReport: true,
    ...options,
  };
}
