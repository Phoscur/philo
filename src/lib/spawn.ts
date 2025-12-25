import { spawn, SpawnOptions } from 'child_process';

const VERBOSE = false;

export const spawnPromise = (
  command: string,
  args?: Array<string>,
  options?: SpawnOptions,
  allowError = true
) =>
  new Promise<Buffer>((resolve, reject) => {
    // console.log('CMD SPAWN', command, args?.join(' '), options);
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
      reject(err);
    });

    childProcess.stdout.on('data', (data: Buffer) => {
      stdoutData = Buffer.concat([stdoutData, data]);
      if (VERBOSE) console.log(command, data.toString());
    });
    childProcess.stdout.once('error', (err: Error) => reject(err));

    childProcess.stderr.on('data', (data: Buffer) => {
      stderrData = Buffer.concat([stderrData, data]);
      if (VERBOSE) console.log('error', command, stderrData.toString());
    });
    childProcess.stderr.once('error', (err: Error) => reject(err));

    childProcess.stdout.on('close', () => {
      console.log('CMD finished', command, stdoutData.length, stderrData.length);
      if (stderrData.length > 0 && !allowError) return reject(new Error(stderrData.toString()));
      if (stderrData.length > 0) {
        console.log('CMD stderr', command, stderrData.toString());
      }

      return resolve(stdoutData);
    });
  });
