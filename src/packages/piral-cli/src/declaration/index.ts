import * as ts from 'typescript';
import { isNodeExported, findPiralBaseApi, findDeclaredTypings } from './helpers';
import { includeExportedType, includeExportedVariable, includeExportedTypeAlias } from './visit';
import { stringifyDeclaration } from './stringify';
import { DeclVisitorContext } from './types';
import { logWarn } from '../common';

export function generateDeclaration(
  name: string,
  root: string,
  files: Array<string>,
  availableImports: Array<string> = [],
) {
  const typingsPath = findDeclaredTypings(root);
  const apiPath = findPiralBaseApi(root);
  const rootNames = [...files, typingsPath].filter(m => !!m);
  const program = ts.createProgram(rootNames, {
    allowJs: true,
  });
  const checker = program.getTypeChecker();
  const context: DeclVisitorContext = {
    modules: {},
    refs: {},
    availableImports,
    usedImports: [],
    checker,
    ids: [],
  };

  const api = program.getSourceFile(apiPath);
  context.modules[name] = context.refs;

  const includeNode = (node: ts.Node) => {
    if (node) {
      if (ts.isTypeAliasDeclaration(node)) {
        includeExportedTypeAlias(context, node);
      } else {
        const type = checker.getTypeAtLocation(node);

        if (ts.isVariableDeclaration(node)) {
          includeExportedVariable(context, node);
        } else if (ts.isVariableStatement(node)) {
          node.declarationList.declarations.forEach(decl => {
            includeExportedVariable(context, decl);
          });
        } else if (type.flags !== ts.TypeFlags.Any) {
          includeExportedType(context, type);
        } else {
          logWarn(`Could not resolve type at position ${node.pos} of "${node.getSourceFile()?.fileName}".`);
        }
      }
    }
  };

  const includeApi = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'PiletApi') {
      includeNode(node);
    }
  };

  const includeTypings = (node: ts.Node) => {
    if (ts.isModuleDeclaration(node)) {
      const moduleName = node.name.text;
      const existing = context.modules[moduleName];
      const before = context.refs;
      context.modules[moduleName] = context.refs = existing || {};
      node.body.forEachChild(subNode => {
        if (isNodeExported(subNode)) {
          includeNode(subNode);
        }
      });
      context.refs = before;
    } else if (isNodeExported(node)) {
      includeNode(node);
    } else if (ts.isExportDeclaration(node)) {
      const moduleName = node.moduleSpecifier?.text;
      const elements = node.exportClause?.elements;

      if (elements) {
        // selected exports here
        elements.forEach(el => {
          if (el.symbol) {
            const original = context.checker.getAliasedSymbol(el.symbol);
            includeNode(original?.declarations?.[0]);
          }
        });
      } else if (moduleName) {
        // * exports from a module
        const fileName = node.getSourceFile().resolvedModules?.get(moduleName)?.resolvedFileName;

        if (fileName) {
          const newFile = program.getSourceFile(fileName);
          ts.forEachChild(newFile, includeTypings);
        }
      }
    }
  };

  if (api) {
    ts.forEachChild(api, includeApi);

    if (typingsPath) {
      const tp = program.getSourceFile(typingsPath);

      if (tp) {
        ts.forEachChild(tp, includeTypings);
      } else {
        logWarn(
          'Cannot find the provided typings. Check the "typings" field of your "package.json" for the correct path.',
        );
      }
    }
  } else {
    throw new Error(
      'Cannot find the "piral-base" module. Are you sure it exists? Please run "npm i" to install missing modules.',
    );
  }

  return stringifyDeclaration(context);
}
