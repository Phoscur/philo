import StreamContainer from './stream'
import TaskEmitter from './TaskEmitter'
import TasksContainer from './tasks'

describe('TaskEmitter', () => {
  it('is an EventEmitter', async () => {
    expect.assertions(2)
    const handler = jest.fn()
    const immediately = new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
    const emitter = new TaskEmitter(handler, immediately)
    emitter.handler(1, 1)
    await new Promise((resolve) => {
      emitter.onFinish(resolve)
    })
    expect(emitter.parts).toEqual(1)
    expect(handler).toHaveBeenCalledWith(1, 1)
  })

  it('can handle (interval) tasks as event emitters', async () => {
    expect.assertions(4)
    const tasks = new TasksContainer(() => {})
    const streams = new StreamContainer(tasks)
    const handler = jest.fn(async () => {})
    const followHandler = jest.fn(async () => {})
    const s = streams.create('id', Date.now(), 2, 1000, handler)
    const e = streams.addStream(s)
    e.onPart(followHandler)
    await new Promise((resolve) => {
      e.onFinish(resolve)
    })
    expect(handler).toHaveBeenCalledWith(0, 1) // TODO seems to be flaky?!
    expect(handler).toHaveBeenCalledWith(1000, 2)
    expect(followHandler).toHaveBeenCalledWith(0, 1)
    expect(followHandler).toHaveBeenCalledWith(1000, 2)
  })
})
