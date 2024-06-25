import { join } from 'path';
import {
  stat,
  mkdir,
  readdir,
  readFile,
  writeFile,
  unlink,
  rm,
  watch,
  copyFile,
} from 'fs/promises';
import { createReadStream, WatchOptions } from 'fs';
import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';

/**
 * FileSystem access
 * Operations are relative to the current working directory and setup path directory
 * @throws {Error} all kinds of file system errors
 */
@injectable
export class FileSystem {
  #logger = inject(Logger);
  cwd = process.cwd();
  #path = '';

  async setupPath(p: string) {
    const isNew = await this.mkdir(p);
    this.#path = p;
    return isNew;
  }

  /**
   * Current folder of interest to operate on
   * So all operations are relative to this path (advantage & pitfall of this design)
   */
  get path() {
    return this.#path;
  }

  joinPath(...paths: string[]) {
    return join(this.path, ...paths);
  }

  watch(options: WatchOptions, file = '') {
    return watch(this.joinPath(file), options);
  }

  getAbsolutePath(folder: string) {
    return join(this.cwd, folder);
  }

  get absolutePath() {
    return join(this.cwd, this.path);
  }

  /**
   * Creates a new folder in the current working directory
   * @returns {boolean} false if folder already exists
   */
  async mkdir(directory: string) {
    try {
      await mkdir(join(this.cwd, directory));
      this.#logger().log(`[Storage: ${this.cwd}/${directory}] Folder created`);
      return true;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
      return false;
    }
  }

  async mkdirp(folders: string[]) {
    const p = join(this.path, ...folders);
    await mkdir(p, { recursive: true });
    this.#logger().log(`[Storage: ${p}] Folder created`);
  }

  async exists(name: string) {
    return stat(join(this.path, name))
      .then(() => true)
      .catch(() => undefined);
  }

  async list() {
    const list = await readdir(this.path);
    // this.#logger().log('[Storage] List:\n °', list.join('\n ° '));
    return list;
  }

  async read(name: string) {
    return readFile(join(this.path, name));
  }

  readStream(name: string) {
    const file = join(this.path, name);
    return createReadStream(file);
  }

  async save(name: string, source: Buffer) {
    await writeFile(join(this.path, name), source);
  }

  async copyFile(source: string, name: string) {
    await copyFile(source, join(this.path, name));
  }

  async delete(name: string) {
    return unlink(join(this.path, name));
  }

  async destroy() {
    await rm(this.path, { recursive: true });
    this.#logger().log(`[Storage: ${this.path}] Folder removed - destroyed`);
    this.#path = '';
  }
}
