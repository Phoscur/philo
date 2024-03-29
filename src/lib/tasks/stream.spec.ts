import { TasksContainer } from './tasks'
import { StreamContainer, TaskStream } from './stream'

describe('Task Stream Container', () => {
  beforeAll(() => {
    StreamContainer.MINIMUM_INTERVAL_SPACING = 100
    TasksContainer.setTimeout = ((resolve: () => void) =>
      setTimeout(resolve, 0)) as typeof setTimeout // shortcut wait
  })

  it('should emit done after the last part', async () => {
    expect.assertions(3)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    const spy = jest.fn(async () => {
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          resolve()
        }, 0)
      )
    })
    const s: TaskStream = streams.create('id', Date.now() - 100, 5, 33, spy)
    const emitter = streams.addStream(s)
    expect(spy).toHaveBeenCalledTimes(0)
    await emitter.done.then(() => {
      expect(spy).toHaveBeenCalledTimes(5)
    })
    // TODO? only start & recalc with:
    await streams.run()
    expect(spy).toHaveBeenCalledTimes(5)
  })

  it('should be busy when using very low intervals', async () => {
    expect.assertions(3)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    const s: TaskStream = streams.create(
      'id',
      Date.now() - 1000,
      3,
      33,
      jest.fn(async () => {})
    )
    const adding = streams.add(s)
    expect(streams.busy).toEqual(true)
    await adding
    await streams.run()
    expect(s.handler).toHaveBeenCalledTimes(3)
    // all is clean, can create one with the same id
    const s2 = streams.create('id')
    s2.handler = jest.fn(async () => {})
    await streams.add(s2)
    expect(s2.handler).toHaveBeenCalledTimes(1)
  })

  it('should cancel not fail', async () => {
    expect.assertions(2)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    const s = streams.create(
      'id',
      Date.now(),
      2,
      20,
      jest.fn(() => {
        throw new Error('Abort')
      })
    )
    const add = streams.add(s)
    streams.cancel(s.id)
    expect(s.handler).not.toHaveBeenCalledTimes(1)
    await add
    await streams.run()
    await streams.add(s)
    expect(s.handler).toHaveBeenCalledTimes(1)
  })

  it('should fail to queue: same id', async () => {
    expect.assertions(1)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    await streams.add(streams.create('id', Date.now(), 1, 20))
    expect(streams.create.bind(streams, 'id', Date.now(), 1, 20)).toThrowError(
      'Stream [id] is already running'
    )
    await streams.run()
  })

  it('should fail to queue: interval timings, not enough time', async () => {
    expect.assertions(1)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    const add1 = streams.add(streams.create('id', Date.now(), 3, 200))
    const add2 = await streams.add(streams.create('id3', Date.now(), 3, 200))
    expect(streams.create.bind(streams, 'id2', Date.now(), 3, 200)).toThrowError(
      'Stream collision [id2, 200ms], spacing 300/200'
    )
    await Promise.all([add1, add2])
    await streams.run()
  })

  it('should fail to queue: interval timings, not enough time extended', async () => {
    expect.assertions(1)
    const tasks = new TasksContainer(() => {})
    const sc = new StreamContainer(tasks)

    const due = Date.now()
    const ts = [
      sc.create('id', due, 1, 500),
      sc.create('id2', due, 1, 500),
      sc.create('id3', due, 1, 500),
      sc.create('id4', due, 1, 500),
      sc.create('id5', due, 1, 500),
    ]
    const run = ts.map((l) => sc.add(l))
    expect(sc.create.bind(sc, 'id6', Date.now(), 3, 300)).toThrowError(
      'Stream collision [id6, 300ms], spacing 600/500'
    )
    await Promise.all(run)
  })

  it('should fail to queue: interval timings, not enough time sequentially', async () => {
    expect.assertions(4)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    const spyF = (r?: () => void) => jest.fn(async () => r && r())
    let spy
    const spyPromise = new Promise<void>((resolve) => (spy = spyF(resolve)))
    const due = streams.now
    const repetitions = 2
    const s1 = streams.create('id1', due, repetitions, 500, spy)
    const s2 = streams.create('id2', due, repetitions, 500, spyF())

    const t1 = streams.add(s1)
    await spyPromise // wait for s1 first execution to finish
    //await streams.run()
    const t2 = streams.add(s2)
    //const [t1, t2] = [s1, s2].map((s) => streams.add(s))
    await Promise.all([t1, t2])
    await streams.run()

    expect(s1.handler).toHaveBeenCalledWith(0, 1)
    expect(s1.handler).toHaveBeenCalledWith(s1.interval, 2)
    // since s1 was still in progress wait 100
    expect(s2.handler).toHaveBeenCalledWith(100, 1)
    expect(s2.handler).toHaveBeenCalledWith(s1.interval, 2)
  })

  it('should fail to queue: interval timings, not enough time extended II', async () => {
    expect.assertions(2)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    const spy = () => jest.fn(async () => {})

    const due = Date.now()
    const repetitions = 2
    const s51 = streams.create('id51', due, repetitions, 500, spy())
    const s52 = streams.create('id52', due, repetitions, 500, spy())
    const s15 = streams.create('id15', due, repetitions, 1500, spy())
    //const s7 = streams.create('id7', due, 2, 7000, spy())

    const all = [s51, s52, s15].map((s) => streams.add(s))

    expect(streams.create.bind(streams, 'id7', Date.now(), 3, 700)).toThrowError(
      'Stream collision [id7, 700ms], interval is locked to modulo 500'
    )

    const s53 = streams.create('id53', due, repetitions, 500, spy())
    await streams.add(s53)
    expect(streams.create.bind(streams, 'id49', Date.now(), 3, 499)).toThrowError(
      'Stream collision [id49, 499ms], spacing is 100 for 4x500'
    )

    await Promise.all(all)
    await streams.run()

    /* without the guards this queues into collision in the second iteration
    expect(s51.handler).toHaveBeenCalledWith(0)
    expect(s51.handler).toHaveBeenCalledWith(s51.interval)

    expect(s52.handler).toHaveBeenCalledWith(1000)
    expect(s52.handler).toHaveBeenCalledWith(s52.interval)

    expect(s53.handler).toHaveBeenCalledWith(2000)
    expect(s54.handler).toHaveBeenCalledWith(3000)

    expect(s7.handler).toHaveBeenCalledWith(4000)
    expect(s7.handler).toHaveBeenCalledWith(7000)
    */
  })
})
