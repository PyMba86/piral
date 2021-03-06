import { join } from 'path';
import { debugPiletApi, pathSeparator, cliVersion, compatVersion } from './info';

export interface StandardEnvProps {
  production?: boolean;
  debugPiral?: boolean;
  debugPilet?: boolean;
  root: string;
  piral?: string;
  dependencies?: Array<string>;
}

function hasPath(path: string) {
  const paths = (process.env.PATH || '').split(pathSeparator);
  return paths.includes(path);
}

export function setStandardEnvs(options: StandardEnvProps) {
  const packageJson = require(join(options.root, 'package.json'));
  const binDir = join(options.root, 'node_modules', '.bin');

  process.env.BUILD_TIME = new Date().toDateString();
  process.env.BUILD_TIME_FULL = new Date().toISOString();
  process.env.BUILD_PCKG_VERSION = packageJson.version;
  process.env.BUILD_PCKG_NAME = packageJson.name;
  process.env.PIRAL_CLI_VERSION = cliVersion;

  if (!hasPath(binDir)) {
    const existing = process.env.PATH || '';
    process.env.PATH = `${existing}${pathSeparator}${binDir}`;
  }

  if (options.debugPiral) {
    process.env.DEBUG_PIRAL = compatVersion;
  } else {
    delete process.env.DEBUG_PIRAL;
  }

  if (options.debugPilet) {
    process.env.DEBUG_PILET = debugPiletApi;
  } else {
    delete process.env.DEBUG_PILET;
  }

  if (options.production) {
    process.env.NODE_ENV = 'production';
  } else if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }

  if (options.dependencies && options.dependencies.length) {
    const excludedDependencies = ['piral', 'piral-core', 'piral-base', options.piral];
    const dependencies = options.dependencies.filter(m => !excludedDependencies.includes(m));
    process.env.SHARED_DEPENDENCIES = dependencies.join(',');
  } else {
    process.env.SHARED_DEPENDENCIES = '';
  }
}
