/*!
 * Copyright 2020 Palantir Technologies, Inc.
 *
 * Licensed under the MIT license. See LICENSE file in the project root for details.
 *
 */

import * as nodeFs from "fs"; // tslint:disable-line:import-blacklist
import * as nodePath from "path";
import * as tmp from "tmp";
import { CachedFileSystem } from "../CachedFileSystem";

describe(CachedFileSystem, () => {
  let tmpDir: tmp.DirResult;
  let cachedFs: CachedFileSystem;

  beforeEach(() => {
    tmpDir = tmp.dirSync();
    cachedFs = new CachedFileSystem();
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it("properly writes", () => {
    const filePath = nodePath.join(tmpDir.name, "hello.json");
    cachedFs.writeJson(filePath, { hello: "world" });
    cachedFs.flush();

    expect(nodeFs.existsSync(filePath)).toBe(true);
    expect(JSON.parse(nodeFs.readFileSync(filePath, "utf-8"))).toEqual({ hello: "world" });
  });

  it("properly overwrites", () => {
    const filePath = nodePath.join(tmpDir.name, "hello.json");
    cachedFs.writeJson(filePath, { hello: "world" });
    cachedFs.writeFile(filePath, "{}");
    cachedFs.flush();

    expect(nodeFs.existsSync(filePath)).toBe(true);
    expect(JSON.parse(nodeFs.readFileSync(filePath, "utf-8"))).toEqual({});
  });

  it("properly fails if directory doesnt exist", () => {
    const filePath = nodePath.join(tmpDir.name, "fakeDir", "hello.json");
    cachedFs.writeFile(filePath, "nothing");
    expect(() => cachedFs.flush()).toThrow();
  });

  it("properly creates directories", () => {
    const dirPath = nodePath.join(tmpDir.name, "fakeDir", "with", "children");

    cachedFs.mkdir(dirPath, { recursive: true });
    cachedFs.flush();

    expect(nodeFs.existsSync(dirPath)).toBeTruthy();
  });
});
