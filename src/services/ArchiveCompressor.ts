import { inject, injectable } from '@joist/di';
import { Logger } from './Logger.js';

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';

import archiver from 'archiver';
import tar from 'tar-stream';

const pipelineAsync = promisify(pipeline);

@injectable()
export class Archiver {
  #logger = inject(Logger);

  async compressFolder(inputFolder: string, outputFile: string): Promise<void> {
    const logger = this.#logger();
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputFile);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 9 },
      });

      output.on('close', () => {
        logger.log(
          `Created Archive "${outputFile}, it has a size of ${archive.pointer()} total bytes`
        );
        resolve();
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          logger.log('Warning:', err);
        } else {
          reject(err);
        }
      });

      archive.on('error', (err) => {
        reject(err);
      });

      // Output stream to the file
      archive.pipe(output);

      // Append files from the input folder to the archive
      archive.directory(inputFolder, false);

      // Finalize the archive (i.e. write the remaining data)
      archive.finalize();
    });
  }

  async extract(archiveFile: string, outputFolder: string): Promise<void> {
    const logger = this.#logger();

    await mkdir(outputFolder, { recursive: true });

    const extract = tar.extract();

    extract.on('entry', async (header, stream, next) => {
      const filePath = join(outputFolder, header.name);

      if (header.type === 'directory') {
        await mkdir(filePath, { recursive: true });
        stream.resume();
        next();
      } else {
        await mkdir(join(filePath, '..'), { recursive: true });
        const fileStream = createWriteStream(filePath);

        await pipelineAsync(stream, fileStream);
        next();
      }
    });

    extract.on('finish', () => {
      logger.log('Archive extraction complete.');
    });

    try {
      await pipelineAsync(createReadStream(archiveFile), createGunzip(), extract);
    } catch (err) {
      logger.log('Error extracting archive:', err);
      throw err;
    }
  }
}

/* 
Anecdote:
I've tried without "archiver", however the resulting file created with zlib is just a ".gz", and we want ".tar", as it adds the folder structure to the archive

# Codex' (ChatGPT-4o) draft to create the tar-stream "from scratch"

import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline, Writable } from 'node:stream';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

function pad(value: string, length: number, padding = '0') {
  return value.padStart(length, padding);
}

function createTarHeader(fileName: string, fileStat: any) {
  const name = fileName.padEnd(100, '\0');
  const mode = pad(fileStat.mode.toString(8), 7) + '\0';
  const uid = pad((fileStat.uid || 0).toString(8), 7) + '\0';
  const gid = pad((fileStat.gid || 0).toString(8), 7) + '\0';
  const size = pad(fileStat.size.toString(8), 11) + '\0';
  const mtime = pad(Math.floor(fileStat.mtime.getTime() / 1000).toString(8), 11) + '\0';
  const checksum = '        ';
  const typeflag = '0';
  const linkname = ''.padEnd(100, '\0');
  const magic = 'ustar\0';
  const version = '00';
  const uname = ''.padEnd(32, '\0');
  const gname = ''.padEnd(32, '\0');
  const devmajor = ''.padEnd(8, '\0');
  const devminor = ''.padEnd(8, '\0');
  const prefix = ''.padEnd(155, '\0');

  let header = Buffer.from(
    name +
      mode +
      uid +
      gid +
      size +
      mtime +
      checksum +
      typeflag +
      linkname +
      magic +
      version +
      uname +
      gname +
      devmajor +
      devminor +
      prefix +
      ''.padEnd(12, '\0'),
    'binary'
  );

  let sum = 0;
  for (const byte of header) {
    sum += byte;
  }
  header.write(pad(sum.toString(8), 6) + '\0 ', 148, 8, 'binary');

  return header;
}

async function addFilesToTarStream(tarStream: Writable, dirPath: string, basePath = '') {
  const files = await readdir(dirPath);

  for (const file of files) {
    const filePath = join(dirPath, file);
    const fileStat = await stat(filePath);

    const tarHeader = createTarHeader(join(basePath, file), fileStat);
    tarStream.write(tarHeader);

    if (fileStat.isDirectory()) {
      await addFilesToTarStream(tarStream, filePath, join(basePath, file));
    } else {
      const fileStream = createReadStream(filePath);
      await pipelineAsync(fileStream, tarStream);

      const padding = Buffer.alloc(512 - (fileStat.size % 512), '\0', 'binary');
      tarStream.write(padding);
    }
  }
}

export async function compressFolder(inputFolder: string, outputFile: string): Promise<void> {
  const gzip = createGzip({ level: 9 });
  const output = createWriteStream(outputFile);

  const tarStream = new Writable({
    write(chunk, encoding, callback) {
      gzip.write(chunk, encoding, callback);
    },
  });

  try {
    await addFilesToTarStream(tarStream, inputFolder);
    tarStream.end();

    await pipelineAsync(gzip, output);
  } catch (err) {
    console.error('Error compressing folder:', err);
    throw err;
  }
}
*/
