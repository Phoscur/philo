import { spawn, SpawnOptions } from 'child_process';

// TODO? is this the spawn handler we want to keep?
export const spawnPromise = (command: string, args?: Array<string>, options?: SpawnOptions) =>
  new Promise<Buffer>((resolve, reject) => {
    console.log('CMD SPAWN', command, args?.join(' '), options);
    const childProcess = spawn(command, args ?? [], options ?? {});

    let stdoutData = Buffer.alloc(0);
    let stderrData = Buffer.alloc(0);

    if (!childProcess.stdout) {
      throw new Error(`No 'stdout' available on spawned process '${command}'`);
    }

    if (!childProcess.stderr) {
      throw new Error(`No 'stderr' available on spawned process '${command}'`);
    }

    childProcess.once('error', (err: Error) => {
      console.error('CMD failed', command, err);
      // reject(err)
    });

    childProcess.stdout.on(
      'data',
      (data: Buffer) => (stdoutData = Buffer.concat([stdoutData, data]))
    );
    childProcess.stdout.once('error', (err: Error) => reject(err));

    childProcess.stderr.on(
      'data',
      (data: Buffer) => (stderrData = Buffer.concat([stderrData, data]))
    );
    childProcess.stderr.once('error', (err: Error) => reject(err));

    childProcess.stdout.on('close', () => {
      console.log('CMD finished', command, stdoutData.length, stderrData.length);
      // if (stderrData.length > 0) return reject(new Error(stderrData.toString()))

      return resolve(stdoutData);
    });
  });

/**
 * Get storage status via `df -h` and `du` commmands,
 * when no folder is given, only the first drive is checked
 * @param folderName
 * @returns
 */
export default async function getStorageStatus(folderName?: string) {
  const dfArgs = ['-h'];
  if (folderName) {
    dfArgs.push(folderName);
  }
  const df = await spawnPromise('df', dfArgs);
  const infos = parseDfString(df.toString());
  if (!folderName) {
    return {
      ...infos,
      folder: '',
    };
  }
  const du = await spawnPromise('du', [folderName]);
  const folder = parseDuString(du.toString());
  return {
    ...infos,
    folder,
  };
}

function parseDfString(df: string) {
  const s = df.split(/\s/).filter((v) => !!v);
  const [drive, size, used, available, percent, mount, ...more] = s.slice(7);
  return {
    drive,
    size,
    used,
    available,
    percent,
    mount,
    more, // TODO? parse lines
  };
}

function parseDuString(du: string): string {
  return Math.round(parseInt(du) / 10000) / 100 + 'G';
}

if (require.main === module) {
  const test = async () => {
    const df = await spawnPromise('df', ['-h', 'storage']);
    console.log('df', df.toString(), parseDfString(df.toString()));
    const du = await spawnPromise('du', ['storage']);
    console.log('du', du.toString(), parseDuString(du.toString()));
    //const dub = await spawnPromise('du', ['storageb'])
    //console.log('du', dub.toString())
    console.log('JSON', await getStorageStatus());
    console.log('JSON folder', await getStorageStatus('storage'));
  };
  test();
}
