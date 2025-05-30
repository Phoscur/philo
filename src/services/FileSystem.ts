import { join } from 'node:path';
import { stat, mkdir, readdir, readFile, writeFile, unlink, rm, copyFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';

export class Directory {
  constructor(
    public readonly logger: Logger,
    public readonly fs: FileSystem,
    /** directory name or base path relative to the cwd */
    public readonly path: string,
    public readonly isNew = false
  ) {}

  get absolutePath() {
    return join(this.fs.cwd, this.path);
  }

  join(name: string) {
    return join(this.path, name);
  }

  joinAbsolute(name: string) {
    return join(this.fs.cwd, this.path, name);
  }

  async exists(name: string) {
    return this.fs.exists(join(this.path, name));
  }

  async list() {
    const list = await readdir(this.path);
    // this.#logger().log('[Storage] List:\n °', list.join('\n ° '));
    return list;
  }

  async mkdirp(folders: string[]) {
    const p = join(this.path, ...folders);
    await mkdir(p, { recursive: true });
    this.logger.log(`[Storage: ${p}] Folder created`);
  }

  async readJSON(name: string): Promise<any | null> {
    try {
      const data = await this.read(name);
      this.logger.log(`[${this.path}/${name}] Loaded!`);
      return JSON.parse(data.toString());
    } catch (error: any) {
      if ('ENOENT' !== error.code) {
        throw error;
      }
      return null;
    }
  }

  async read(name: string) {
    return readFile(join(this.path, name));
  }

  readStream(name: string) {
    const file = join(this.path, name);
    return createReadStream(file);
  }

  async saveJSON(name: string, data: any) {
    await this.save(name, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
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
}

/**
 * FileSystem access
 * Operations are relative to the current working directory and setup path directory
 * @throws {Error} all kinds of file system errors
 */
@injectable
export class FileSystem {
  #logger = inject(Logger);
  cwd = process.cwd();

  getAbsolutePath(folder: string) {
    return join(this.cwd, folder);
  }

  async createDirectory(path: string) {
    return this.dir(path, await this.mkdir(path));
  }

  dir(path: string, isNew = false) {
    return new Directory(this.#logger(), this, path, isNew);
  }

  /**
   * Creates a new folder in the current working directory
   * @returns {boolean} false if folder already exists
   */
  async mkdir(directory: string) {
    try {
      await mkdir(join(this.cwd, directory), { recursive: true });
      this.#logger().log(`[Storage: ${join(this.cwd, directory)}] Directory created`);
      return true;
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }
      return false;
    }
  }

  async exists(name: string) {
    return stat(name)
      .then(() => true)
      .catch(() => undefined);
  }

  async destroy(name: string) {
    await rm(name, { recursive: true });
    this.#logger().log(`[Storage: ${name}] Folder removed - destroyed`);
  }
}
