/*!
 * Copyright 2020 Palantir Technologies, Inc.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 */

import { WorkspaceContext } from "@monorepolint/core";
import { PackageJson, readJson, writeJson } from "@monorepolint/utils";
import * as path from "path";
import * as tmp from "tmp";
import { consistentVersions, Options } from "../consistentVersions";
import { makeDirectoryRecursively } from "../util/makeDirectory";

describe("consistentVersions", () => {
  tmp.setGracefulCleanup();

  let cleanupJobs: Array<() => void> = [];
  let cwd: string | undefined;

  beforeEach(() => {
    const dir = tmp.dirSync();
    cleanupJobs.push(() => dir.removeCallback());
    cwd = dir.name;

    const spy = jest.spyOn(process, "cwd");
    spy.mockReturnValue(cwd);
  });

  afterEach(() => {
    for (const cleanupJob of cleanupJobs) {
      cleanupJob();
    }
    cleanupJobs = [];
  });

  function makeWorkspace(fix = false) {
    const workspaceContext = new WorkspaceContext(cwd!, {
      rules: [],
      fix,
      verbose: false,
      silent: true,
    });
    const addErrorSpy = jest.spyOn(workspaceContext, "addError");

    function check(options: Options = { matchDependencyVersions: {} }) {
      consistentVersions.check(workspaceContext, options);
    }

    return { addErrorSpy, check };
  }

  function addPackageJson(filePath: string, packageJson: PackageJson) {
    const dirPath = path.resolve(cwd!, path.dirname(filePath));
    const resolvedFilePath = path.resolve(cwd!, filePath);

    makeDirectoryRecursively(dirPath);
    writeJson(resolvedFilePath, packageJson);
    return (): PackageJson => {
      return readJson(resolvedFilePath);
    };
  }

  describe("standard tests", () => {
    let testPackageJson: PackageJson;

    beforeEach(() => {
      testPackageJson = {
        name: "test",
        dependencies: {
          greatLib: "^15",
          both: "1",
        },
        peerDependencies: {
          whatever: "15",
        },
        devDependencies: {
          else: "27.2.1",
          both: "1",
        },
      };
    });

    it("Does nothing when arguments are empty", async () => {
      const { addErrorSpy, check } = makeWorkspace();
      addPackageJson("./package.json", testPackageJson);

      check();
      expect(addErrorSpy).toHaveBeenCalledTimes(0);
      check({ matchDependencyVersions: {} });
      expect(addErrorSpy).toHaveBeenCalledTimes(0);
    });

    it("Fixes packages that have an incorrect dependency version", async () => {
      const { addErrorSpy, check } = makeWorkspace(true);
      const readTestPackageJson = addPackageJson("./package.json", testPackageJson);

      const requiredGreatLibVersion = "1.2.3";
      expect(addErrorSpy).toHaveBeenCalledTimes(0);
      check({
        matchDependencyVersions: { both: testPackageJson.dependencies!.both, greatLib: requiredGreatLibVersion },
      });
      expect(addErrorSpy).toHaveBeenCalledTimes(1);
      expect(readTestPackageJson().dependencies!.greatLib).toEqual(requiredGreatLibVersion);
    });

    it("Ignores packages that have a correct dependency version", async () => {
      const { addErrorSpy, check } = makeWorkspace();
      addPackageJson("./package.json", testPackageJson);

      expect(addErrorSpy).toHaveBeenCalledTimes(0);
      check({
        matchDependencyVersions: {
          both: testPackageJson.dependencies!.both,
          greatLib: testPackageJson.dependencies!.greatLib,
        },
      });
      expect(addErrorSpy).toHaveBeenCalledTimes(0);
    });

    it("Fixes packages that have an incorrect devDependency version", async () => {
      const { addErrorSpy, check } = makeWorkspace(true);
      const readTestPackageJson = addPackageJson("./package.json", testPackageJson);

      const requiredElseLibVersion = "1.2.3";
      expect(addErrorSpy).toHaveBeenCalledTimes(0);
      check({ matchDependencyVersions: { both: testPackageJson.dependencies!.both, else: requiredElseLibVersion } });
      expect(addErrorSpy).toHaveBeenCalledTimes(1);
      expect(readTestPackageJson().devDependencies!.else).toEqual(requiredElseLibVersion);
    });

    it("Ignores packages that have a correct devDependency version", async () => {
      const { addErrorSpy, check } = makeWorkspace();
      addPackageJson("./package.json", testPackageJson);

      expect(addErrorSpy).toHaveBeenCalledTimes(0);
      check({
        matchDependencyVersions: {
          both: testPackageJson.dependencies!.both,
          greatLib: testPackageJson.dependencies!.greatLib,
        },
      });
      expect(addErrorSpy).toHaveBeenCalledTimes(0);
    });

    it("Fixes packages that have an incorrect dependency and devDependency versions", async () => {
      const { addErrorSpy, check } = makeWorkspace(true);
      const readTestPackageJson = addPackageJson("./package.json", testPackageJson);

      const requiredBothVersion = "1.2.3";
      expect(addErrorSpy).toHaveBeenCalledTimes(0);
      check({ matchDependencyVersions: { both: requiredBothVersion } });
      expect(addErrorSpy).toHaveBeenCalledTimes(2);
      expect(readTestPackageJson().dependencies!.both).toEqual(requiredBothVersion);
      expect(readTestPackageJson().devDependencies!.both).toEqual(requiredBothVersion);
    });
  });
});
