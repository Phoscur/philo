import { spawnPromisePrependStdErr } from './spawn'

export interface StitchOptions {
  framerate?: number
  crf?: number
  inFiles?: string
  outFile?: string
  parts?: number
}

export default async function stitchImages(
  name: string,
  cwd: string,
  options: StitchOptions = {},
  inFolder: string = '.',
  outFolder: string = '.'
) {
  const partMatch = !options.parts ? '%d' : '%0' + options.parts.toString().length + 'd' // e.g. %04d - without zero padding use %d instead
  const optionsWithDefaults = {
    framerate: 18,
    crf: 28,
    inFiles: `${inFolder}/${name}-${partMatch}.jpg`,
    outFile: `${outFolder}/${name}.mp4`,
    //outFile: name+".mp4",
    ...options,
  }

  const gif = optionsWithDefaults.outFile.endsWith('.gif') // no x264 codec for gifs

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
          'crop=iw-216:ih-628,scale=1920:1200',
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
    //'-vf crop=iw-216:ih-628,scale=1920:1200',
    //'-vf scale=2028:-1', // rescale width (and height relatively)
    // input file's resolution: 4056x3048 (1920*2=3840+216; 1080*2=2160+888)
    '-an',
    optionsWithDefaults.outFile.toString(),
  ]
  console.log('ffmpeg', ...args)
  try {
    // for some reason ffmpeg needs to spit errors even if it produces a good result
    return await spawnPromisePrependStdErr('ffmpeg', args, { cwd })
  } catch (err: any) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`Could not stitch images [${name}*.jpg] with ffmpeg, is it installed?`)
    }
    throw err
  }
}
