/**
 * @license Copyright 2019 Palantir Technologies, Inc. All rights reserved.
 */

import { PackageJson } from "@monorepolint/utils";
import path from "path";

/** Interface for a node in a package dependency graph. */
export interface IPackageDependencyGraphNode {
  packageJson: PackageJson;
  dependencies: Map<string, IPackageDependencyGraphNode>;
  paths: {
    packageJsonPath: string;
    rootDirectory: string;
  };
}

/** Service abstraction for constructing and traversing package dependency graphs. */
export interface IPackageDependencyGraphService {
  /** Construct a graph of package dependencies. */
  buildDependencyGraph(packageJsonPath: string): IPackageDependencyGraphNode;

  /** Traverse a package dependency graph. */
  traverse(
    root: IPackageDependencyGraphNode,
    opts?: {
      /** Traverse each unique path to a given package (potentially slow). */
      traverseAllPaths?: boolean;
    }
  ): IterableIterator<IPackageDependencyGraphNode & { importPath: IPackageDependencyGraphNode[] }>;
}

/** Default implementation of the package dependency graph service. */
export class PackageDependencyGraphService implements IPackageDependencyGraphService {
  /** Construct a graph of package dependencies and return the root node. */
  public buildDependencyGraph(startPackageJsonPath: string): IPackageDependencyGraphNode {
    const nodes = new Map<string, IPackageDependencyGraphNode>();

    const visit = (packageJsonPath: string): IPackageDependencyGraphNode => {
      console.warn("VISIT", packageJsonPath, process.cwd())
      if (nodes.has(packageJsonPath)) {
        return nodes.get(packageJsonPath)!;
      }

      const packageJson: PackageJson = require(packageJsonPath);
      const node: IPackageDependencyGraphNode = {
        packageJson,
        dependencies: new Map<string, IPackageDependencyGraphNode>(),
        paths: {
          packageJsonPath,
          rootDirectory: path.dirname(packageJsonPath),
        },
      };

      // It's important that we register the node before visiting its dependencies to avoid cycles
      nodes.set(packageJsonPath, node);

      const dependencies = packageJson.dependencies != null ? Object.keys(packageJson.dependencies) : [];
      for (const dependency of dependencies) {
        node.dependencies.set(
          dependency,
          visit(require.resolve(`${dependency}/package.json`, { paths: [node.paths.rootDirectory] }))
        );
      }

      return node;
    };

    return visit(startPackageJsonPath);
  }

  /** Traverse a package dependency graph with an iterator. */
  public *traverse(
    root: IPackageDependencyGraphNode,
    opts = { traverseAllPaths: false }
  ): IterableIterator<IPackageDependencyGraphNode & { importPath: IPackageDependencyGraphNode[] }> {
    const visited = new Set<IPackageDependencyGraphNode>();

    function* visit(
      node: IPackageDependencyGraphNode,
      importPath: IPackageDependencyGraphNode[] = []
    ): IterableIterator<IPackageDependencyGraphNode & { importPath: IPackageDependencyGraphNode[] }> {
      // Don't visit a package more than once unless explicitly asked to traverse all paths
      if (!opts.traverseAllPaths && visited.has(node)) {
        return;
      }

      // Break cycles when traversing all paths
      if (importPath.indexOf(node) !== -1) {
        return;
      }

      // Visit the node
      visited.add(node);
      importPath = [...importPath, node];
      yield { ...node, importPath };

      // Recursively visit the node's dependencies
      for (const dependency of node.dependencies.values()) {
        yield* visit(dependency, importPath);
      }
    }

    yield* visit(root);
  }
}
