import TasksContainer from './tasks'
import StreamContainer, { PhotoFileStream } from './stream'

const sleep = (ms: number = 0): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

describe('Photo File Stream', () => {
  beforeAll(() => {
    TasksContainer.setTimeout = ((resolve: () => void) =>
      setTimeout(resolve, 0)) as typeof setTimeout // shortcut wait
  })
  it('should be busy when using very low intervals', async () => {
    expect.assertions(2)
    const tasks = new TasksContainer()
    const streams = new StreamContainer(tasks)
    const s: PhotoFileStream = streams.create(
      'id',
      33,
      3,
      jest.fn(async () => {})
    )
    expect(streams.busy).toEqual(true)
    await streams.run()
    expect(s.handler).toHaveBeenCalled()
  })
  it('should handle fail/cancel in queue', async () => {
    expect.assertions(1)
    const tasks = new TasksContainer()
    const streams = new StreamContainer(tasks)
    const s = streams.create(
      'id',
      20,
      2,
      jest.fn(() => {
        throw new Error('Abort')
      })
    )
    await streams.run()
    expect(s.handler).toHaveBeenCalledTimes(1)
  })
  it('should fail to queue: same id', async () => {
    expect.assertions(1)
    const tasks = new TasksContainer()
    const streams = new StreamContainer(tasks)
    streams.create('id', 20)
    expect(streams.create.bind(streams, 'id', 20, 1)).toThrowError('Stream [id] is already running')
    await streams.run()
  })
  it('should fail to queue: interval timings, not enough time', async () => {
    expect.assertions(1)
    const tasks = new TasksContainer()
    const streams = new StreamContainer(tasks)
    streams.create('id', 2000, 3)
    streams.create('id3', 2000, 3)
    expect(streams.create.bind(streams, 'id2', 2000, 3)).toThrowError(
      'Stream collision [id2, 2000ms], spacing 3000/2000'
    )
    await streams.run()
  })
  it('should fail to queue: interval timings, not enough time extended', async () => {
    expect.assertions(1)
    const tasks = new TasksContainer()
    const streams = new StreamContainer(tasks)
    streams.create('id', 5000, 13)
    streams.create('id2', 5000, 13)
    streams.create('id3', 5000, 13)
    streams.create('id4', 5000, 13)
    streams.create('id5', 5000, 13)
    expect(streams.create.bind(streams, 'id6', 3000, 3)).toThrowError(
      'Stream collision [id6, 3000ms], spacing 6000/5000'
    )
    await streams.run()
  })
  it('should fail to queue: interval timings, not enough time extended II', async () => {
    // expect.assertions(1)
    const tasks = new TasksContainer()
    const streams = new StreamContainer(tasks)
    const spy = () => jest.fn(async () => {})

    const s51 = streams.create('id51', 5000, 13, spy())
    const s52 = streams.create('id52', 5000, 13, spy())
    const s53 = streams.create('id53', 5000, 13, spy())
    const s54 = streams.create('id54', 5000, 13, spy())
    const s7 = streams.create('id7', 7000, 13, spy())
    await streams.run()
    expect(s51.handler).toHaveBeenCalledWith(s51.interval)
    expect(s52.handler).toHaveBeenCalledWith(1000)
    expect(s53.handler).toHaveBeenCalledWith(1000)
    expect(s54.handler).toHaveBeenCalledWith(1000)
    expect(s7.handler).toHaveBeenCalledWith(2000)
  })
  it.skip('should queue tasks', async () => {
    const tasks = new TasksContainer()
    const id = 'id'
    const wait = 100
    const id2 = 'id2'
    const wait2 = 200
    const delay = 500
    let executed = false
    const tp = tasks
      .createWaitTask(id, wait)
      .then(() => sleep(wait2)) // wait 1+2
      .then(() => {
        executed = true
      })
    const tp2 = tasks.createWaitTask(id2, wait2)
    //expect.assertions(2)
    await tp2
    // check if tp2 is delayed
    expect(executed).toEqual(true)
    return expect(tp).resolves.toEqual(undefined)
  })
})
