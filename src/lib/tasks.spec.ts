import TasksContainer from './tasks'

describe('Tasks', () => {
  it('can be canceled', () => {
    const tasks = new TasksContainer()
    const id = 'id'
    const wait = 1000
    const tp = tasks.createWaitTask(id, wait)
    tasks.cancel(id)
    expect.assertions(1)
    return expect(tp).rejects.toEqual('Aborted: id')
  })

  it('resolves', () => {
    const tasks = new TasksContainer()
    const id = 'id'
    const wait = 10
    const tp = tasks.createWaitTask(id, wait)
    expect.assertions(1)
    return expect(tp).resolves.toEqual(undefined)
  })

  it('fails', () => {
    const tasks = new TasksContainer()
    const id = 'id'
    const wait = 10
    tasks.cancel(id) // cancelling anything inexistent is ignored
    tasks.createWaitTask(id, wait)
    expect(tasks.createWaitTask.bind(tasks, id, wait)).toThrowError(
      'An ongoing Task [id] already exists!'
    )
  })
})
