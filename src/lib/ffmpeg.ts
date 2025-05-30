import { spawn, SpawnOptions } from 'child_process';
// can't unify this with spawnPromise... because ffmpeg abuses stderr to post progress
export const spawnPromisePrependStdErr = (
  command: string,
  args?: Array<string>,
  options?: SpawnOptions,
  onData = (_frame: string, _fps: string) => {}
) =>
  new Promise<Buffer>((resolve, reject) => {
    const childProcess = spawn(command, args ?? [], options ?? {});

    let stdoutData = Buffer.alloc(0);
    let stderrData = Buffer.alloc(0);

    if (!childProcess.stdout) {
      throw new Error(`No 'stdout' available on spawned process '${command}'`);
    }

    if (!childProcess.stderr) {
      throw new Error(`No 'stderr' available on spawned process '${command}'`);
    }

    childProcess.once('error', (err: Error) => reject(err));

    childProcess.stdout.on('data', (data: Buffer) => {
      stdoutData = Buffer.concat([stdoutData, data]);
      console.log('[ffmpeg]', data.toString());
    });
    childProcess.once('error', (err: Error) => {
      console.error('CMD failed', command, err);
      // TODO? reject(err)
    });
    childProcess.stderr.on('data', (data: Buffer) => {
      stderrData = Buffer.concat([stderrData, data]);
      const str = data.toString();
      console.log('[ffmpeg err]', str);
      const pattern = /frame=[ ]*([0-9]+) fps=(([0-9]*[.])?[0-9]+)/g;
      const match = pattern.exec(str);
      if (match) {
        const [_, frame, fps] = match;
        onData(frame, fps);
      }
    });
    childProcess.stderr.once('error', (err: Error) => {
      console.log(
        'Command unsuccessful',
        command,
        args,
        'Error:',
        stderrData.length,
        'Output:',
        stdoutData.length,
        'Warnings:',
        stderrData.toString()
      );
      reject(err);
    });

    childProcess.stdout.on('close', () => {
      if (stderrData.length > 0) {
        return resolve(Buffer.concat([stderrData, stdoutData]));
      }

      return resolve(stdoutData);
    });
  });

export interface StitchOptions {
  framerate?: number;
  crf?: number;
  inFiles?: string;
  outFile?: string;
  parts?: number;
}

export async function stitchImages(
  name: string,
  cwd: string,
  options: StitchOptions = {},
  inFolder: string = '.',
  outFolder: string = '.',
  onStatus = (_frame: string, _fps: string) => {},
  logger = { log: console.log }
) {
  const partMatch = !options.parts ? '%d' : '%0' + options.parts.toString().length + 'd'; // e.g. %04d - without zero padding use %d instead
  const optionsWithDefaults = {
    framerate: 18,
    crf: 28,
    inFiles: `${inFolder}/${name}-${partMatch}.jpg`,
    outFile: `${outFolder}/${name}.mp4`,
    //outFile: name+".mp4",
    ...options,
  };

  const gif = optionsWithDefaults.outFile.endsWith('.gif'); // no x264 codec for gifs

  // e.g. ffmpeg -framerate 10 -pattern_type glob -i "sun-down-*.jpg" -c:v libx264 -crf 28 -movflags +faststart -an sun-down.mp4
  const args = [
    // delay between frames
    '-framerate',
    optionsWithDefaults.framerate.toString(),
    // '-pattern_type', // use * instead of %d
    // 'glob',
    '-i',
    optionsWithDefaults.inFiles.toString(),
    ...(gif
      ? []
      : [
          '-vf',
          'crop=iw-216:ih-748,scale=1920:1080',
          //'crop=iw-216:ih-628,scale=1920:1200',
          '-c:v',
          'libx264',
          // crf encoding
          '-crf',
          optionsWithDefaults.crf.toString(),
        ]),
    // "-movflags", "+faststart",
    //'-filter:v "crop=1920:1080:0:0"',
    //'-filter:v "crop=iw-400:ih-40,scale=1920:1080"',
    //'-filter:v "crop=iw-216:ih-888,scale=1920:1080"',
    //'-filter:v "crop=iw-216:ih-628,scale=1920:1200"',
    //'-vf scale=2028:-1', // rescale width (and height relatively)
    // input file's resolution: 4056x3048 (1920*2=3840+216; 1080*2=2160+888)
    '-an',
    optionsWithDefaults.outFile.toString(),
  ];
  logger.log('ffmpeg', ...args);
  try {
    // for some reason ffmpeg needs to spit errors even if it produces a good result
    return await spawnPromisePrependStdErr('ffmpeg', args, { cwd }, onStatus);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`Could not stitch images [${name}*.jpg] with ffmpeg, is it installed?`);
    }
    throw err;
  }
}

// TODO refactor spawn promise - fix this test?
if (import.meta.url.endsWith(process.argv[1])) {
  // ffmpeg -framerate 18 -i sunset-2024-08-04/sunset-timelapse-2024-08-04--14-21-%02d.jpg -vf crop=iw-216:ih-628,scale=1920:1200 -c:v libx264 -crf 28 -an sunset-2024-08/sunset-timelapse-2024-08-04--14-21.mp4
  stitchImages(
    'sunset-timelapse-2024-08-04--14-21',
    process.cwd(),
    {
      parts: 40,
    },
    'sunset-2024-08-04'
  )
    .then((message) => {
      console.log(message);
    })
    // reports [Error: failed to read sensor] when the sensor is not connected
    .catch(console.error);
}
