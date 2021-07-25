import { join } from 'path'
import { spawnPromisePrependStdErr } from "./spawn";

export interface StitchOptions {
  framerate?: number
  crf?: number
  inFiles?: string
  outFile?: string
}

export default async function stitchImages(name: string, options = {}) {
  // TODO use path from FileStorage
  const storagePath = join(__dirname, '../..', 'storage')
  const optionsWithDefaults = {
    framerate: 10,
    crf: 28,
    inFiles: `${name}*.jpg`,
    outFile: `${name}.mp4`,
    //outFile: name+".mp4",
    ...options
  };

  const gif = optionsWithDefaults.outFile.endsWith('.gif'); // no x264 codec for gifs

  // e.g. ffmpeg -framerate 10 -pattern_type glob -i "sun-down-*.jpg" -c:v libx264 -crf 28 -movflags +faststart -an sun-down.mp4
  const args = [
    // delay between frames
    "-framerate", optionsWithDefaults.framerate.toString(),
    "-pattern_type", "glob",
    "-i", optionsWithDefaults.inFiles.toString(),
    ...(gif ? [] : ["-c:v", "libx264",
    // crf encoding
    "-crf", optionsWithDefaults.crf.toString()]),
    // "-movflags", "+faststart",
    "-an",
    optionsWithDefaults.outFile.toString(),
  ];

  try {
    // for some reason ffmpeg needs to spit errors even if it produces a good result
    return await spawnPromisePrependStdErr("ffmpeg", args, { cwd: storagePath });
  }
  catch (err) {

    if (err.code === "ENOENT") {
      throw new Error("Could not stitch images with ffmpeg, is it installed?");
    }
    throw err;
  }
};