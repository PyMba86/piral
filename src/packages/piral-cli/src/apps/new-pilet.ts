import { resolve, basename } from 'path';
import {
  createDirectory,
  createFileIfNotExists,
  defaultRegistry,
  installPackage,
  dissectPackageName,
  copyPiralFiles,
  patchPiletPackage,
  ForceOverwrite,
  PiletLanguage,
  scaffoldPiletSourceFiles,
  logInfo,
  installDependencies,
  combinePackageRef,
  getPackageName,
  getPackageVersion,
  readPiralPackage,
  getPiletsInfo,
  runScript,
  TemplateType,
  checkAppShellPackage,
  createContextLogger,
} from '../common';

export interface NewPiletOptions {
  registry?: string;
  target?: string;
  source?: string;
  forceOverwrite?: ForceOverwrite;
  language?: PiletLanguage;
  install?: boolean;
  template?: TemplateType;
}

export const newPiletDefaults = {
  target: '.',
  registry: defaultRegistry,
  source: 'piral',
  forceOverwrite: ForceOverwrite.no,
  language: PiletLanguage.ts,
  install: true,
  template: 'default' as const,
};

export async function newPilet(baseDir = process.cwd(), options: NewPiletOptions = {}) {
  const {
    target = newPiletDefaults.target,
    registry = newPiletDefaults.registry,
    source = newPiletDefaults.source,
    forceOverwrite = newPiletDefaults.forceOverwrite,
    language = newPiletDefaults.language,
    install = newPiletDefaults.install,
    template = newPiletDefaults.template,
  } = options;
  const root = resolve(baseDir, target);
  const [sourceName, sourceVersion, hadVersion, type] = await dissectPackageName(baseDir, source);
  const success = await createDirectory(root);

  if (success) {
    const logger = createContextLogger();
    logInfo(`Scaffolding new pilet in %s ...`, root);

    await createFileIfNotExists(
      root,
      'package.json',
      JSON.stringify(
        {
          name: basename(root),
          version: '1.0.0',
          description: '',
          keywords: ['pilet'],
          dependencies: {},
          devDependencies: {},
          peerDependencies: {},
          scripts: {},
          main: 'dist/index.js',
          files: ['dist'],
        },
        undefined,
        2,
      ),
    );

    if (registry !== newPiletDefaults.registry) {
      logInfo(`Setting up NPM registry (%s) ...`, registry);

      await createFileIfNotExists(
        root,
        '.npmrc',
        `registry=${registry}
always-auth=true`,
        forceOverwrite,
      );
    }

    const packageRef = combinePackageRef(sourceName, sourceVersion, type);

    logInfo(`Installing NPM package %s ...`, packageRef);

    await installPackage(packageRef, root, '--save-dev', '--no-package-lock');

    const packageName = await getPackageName(root, sourceName, type);
    const packageVersion = getPackageVersion(hadVersion, sourceName, sourceVersion, type);
    const piralInfo = await readPiralPackage(root, packageName);

    checkAppShellPackage(piralInfo);

    const { preScaffold, postScaffold } = getPiletsInfo(piralInfo);

    if (preScaffold) {
      logInfo(`Running preScaffold script ...`);
      await runScript(preScaffold, root);
    }

    logInfo(`Taking care of templating ...`);
    await scaffoldPiletSourceFiles(template, language, root, packageName, forceOverwrite);
    await patchPiletPackage(root, packageName, packageVersion, piralInfo, language);
    await copyPiralFiles(root, packageName, ForceOverwrite.yes, [], logger.notify);

    if (install) {
      logInfo(`Installing dependencies ...`);
      await installDependencies(root, '--no-package-lock');
    }

    if (postScaffold) {
      logInfo(`Running postScaffold script ...`);
      await runScript(postScaffold, root);
    }

    logger.summary();
    logger.throwIfError();
  } else {
    throw new Error('Could not create directory.');
  }
}
