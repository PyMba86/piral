import { PiletApiCreator, LoadPiletsOptions, getDependencyResolver, loadPilet } from 'piral-base';
import { globalDependencies, getLocalDependencies } from './modules';
import {
  AvailableDependencies,
  Pilet,
  PiletRequester,
  GlobalStateContext,
  PiletDependencyGetter,
  PiletLoadingStrategy,
} from './types';

/**
 * Creates a dependency getter that sets the shared dependencies explicitly.
 * Overrides the potentially set shared dependencies from the Piral CLI, but
 * keeps all global dependencies such as react, react-dom, ...
 * @param sharedDependencies The shared dependencies to declare.
 */
export function setSharedDependencies(sharedDependencies: AvailableDependencies) {
  const dependencies = {
    ...globalDependencies,
    ...sharedDependencies,
  };
  return () => dependencies;
}

/**
 * Creates a dependency getter that extends the shared dependencies with additional dependencies.
 * @param additionalDependencies The additional dependencies to declare.
 */
export function extendSharedDependencies(additionalDependencies: AvailableDependencies) {
  const dependencies = {
    ...getLocalDependencies(),
    ...additionalDependencies,
  };
  return () => dependencies;
}

interface PiletOptionsConfig {
  availablePilets: Array<Pilet>;
  createApi: PiletApiCreator;
  getDependencies: PiletDependencyGetter;
  strategy: PiletLoadingStrategy;
  requestPilets: PiletRequester;
  context: GlobalStateContext;
}

export function createPiletOptions({
  context,
  createApi,
  availablePilets,
  getDependencies,
  strategy,
  requestPilets,
}: PiletOptionsConfig): LoadPiletsOptions {
  // if we build the debug version of piral (debug and emulator build)
  if (process.env.DEBUG_PIRAL !== undefined) {
    // the DEBUG_PIRAL env should contain the Piral CLI compatibility version
    window['dbg:piral'] = {
      debug: 'v0',
      instance: {
        name: process.env.BUILD_PCKG_NAME,
        version: process.env.BUILD_PCKG_VERSION,
        dependencies: process.env.SHARED_DEPENDENCIES,
        context,
      },
      build: {
        date: process.env.BUILD_TIME_FULL,
        cli: process.env.PIRAL_CLI_VERSION,
        compat: process.env.DEBUG_PIRAL,
      },
      pilets: {
        createApi,
        getDependencies,
        requestPilets,
      },
    };
  }

  if (process.env.DEBUG_PILET !== undefined) {
    // check if pilets should be loaded
    const loadPilets = sessionStorage.getItem('dbg:load-pilets') === 'on';
    const noPilets = () => Promise.resolve([]);
    requestPilets = loadPilets ? requestPilets : noPilets;
  }

  return {
    pilets: availablePilets,
    getDependencies,
    strategy,
    dependencies: globalDependencies,
    fetchPilets() {
      const promise = requestPilets();

      // if we run against the debug pilet API (emulator build only)
      if (process.env.DEBUG_PILET !== undefined) {
        // the DEBUG_PILET env should point to an API address used as a proxy
        const initialTarget = `${location.origin}${process.env.DEBUG_PILET}`;
        const updateTarget = initialTarget.replace('http', 'ws');
        const appendix = fetch(initialTarget).then(res => res.json());
        const ws = new WebSocket(updateTarget);

        ws.onmessage = ({ data }) => {
          const hardRefresh = sessionStorage.getItem('dbg:hard-refresh') === 'on';

          // standard setting is to just perform an inject
          if (!hardRefresh) {
            const meta = JSON.parse(data);
            const getter = getDependencyResolver(globalDependencies, getDependencies);
            const fetcher = (url: string) =>
              fetch(url, {
                method: 'GET',
                cache: 'reload',
              }).then(m => m.text());
            loadPilet(meta, getter, fetcher).then(pilet => {
              try {
                const newApi = createApi(pilet);
                context.injectPilet(pilet);
                pilet.setup(newApi);
              } catch (error) {
                console.error(error);
              }
            });
          } else {
            location.reload();
          }
        };

        return promise
          .catch(err => {
            console.error(`Requesting the pilets failed. We'll continue loading without pilets (DEBUG only).`, err);
            return [];
          })
          .then(pilets => appendix.then(pilet => [...pilets, pilet]));
      }

      return promise;
    },
    createApi,
  };
}
