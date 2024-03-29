import { spawn, SpawnOptions } from 'child_process'

export const spawnPromisePrependStdErr = (
  command: string,
  args?: Array<string>,
  options?: SpawnOptions
) =>
  new Promise<Buffer>((resolve, reject) => {
    const childProcess = spawn(command, args ?? [], options ?? {})

    let stdoutData = Buffer.alloc(0)
    let stderrData = Buffer.alloc(0)

    if (!childProcess.stdout) {
      throw new Error(`No 'stdout' available on spawned process '${command}'`)
    }

    if (!childProcess.stderr) {
      throw new Error(`No 'stderr' available on spawned process '${command}'`)
    }

    childProcess.once('error', (err: Error) => reject(err))

    childProcess.stdout.on('data', (data: Buffer) => {
      stdoutData = Buffer.concat([stdoutData, data])
      console.log('[ffmpeg]', stdoutData.toString())
    })
    childProcess.once('error', (err: Error) => {
      console.error('CMD failed', command, err)
      // TODO? reject(err)
    })
    childProcess.stderr.on('data', (data: Buffer) => {
      stderrData = Buffer.concat([stderrData, data])
      console.warn(stderrData.toString())
    })
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
      )
      reject(err)
    })

    childProcess.stdout.on('close', () => {
      if (stderrData.length > 0) {
        return resolve(Buffer.concat([stderrData, stdoutData]))
      }

      return resolve(stdoutData)
    })
  })
