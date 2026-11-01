const { randomUUID } = require('node:crypto')
const TIMEOUT_MS = 5_000
function withTimeout(promise, timeout = TIMEOUT_MS) {
  let timer
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('保存超时，请重试')), timeout)
  })]).finally(() => clearTimeout(timer))
}

/** 全局串行队列保证主窗口一次只提交一个有收据的命令。 */
function createNoteRequests(send, timeout = TIMEOUT_MS) {
  let tail = Promise.resolve()
  const pending = new Map()
  const completed = new Map()
  const active = new Map()
  function request(command, requestId = randomUUID()) {
    if (completed.has(requestId)) return Promise.resolve(completed.get(requestId))
    if (active.has(requestId)) return active.get(requestId)
    let expired = false
    const work = tail.then(() => {
      if (expired) throw new Error('保存超时，请重试')
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject })
        try { send({ ...command, requestId }) } catch (error) { reject(error) }
      })
    })
    const result = withTimeout(work, timeout).catch(error => ({ requestId, accepted: false, version: 0, error: error.message }))
      .then(value => {
        if (value.accepted) completed.set(requestId, value)
        return value
      }).finally(() => { expired = true; pending.delete(requestId); active.delete(requestId) })
    tail = result
    active.set(requestId, result)
    return result
  }
  function acknowledge(result) {
    pending.get(result.requestId)?.resolve(result)
  }
  return { request, acknowledge }
}
module.exports = { createNoteRequests, withTimeout, TIMEOUT_MS }
