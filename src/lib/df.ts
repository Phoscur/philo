import { spawnPromise } from './spawn.js';

/**
 * Get storage status via `df -h` and `du` commmands,
 * when no folder is given, only the first drive is checked
 * @param folderName
 * @returns
 */
export async function getStorageStatus(folderName?: string) {
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

if (import.meta.url.endsWith(process.argv[1].split(/\/|\\/).pop() as string)) {
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
