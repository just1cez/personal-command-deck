// 独立测试入口：真实 Electron + 生产 main/preload/renderer，不添加生产测试后门。
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const profile = process.argv[2]
const stage = process.argv[3]
app.setPath('userData', profile)
const dialogs = []
let dialogResponse = 1
let dialogHook = async () => {}
dialog.showMessageBox = async (...args) => {
  const options = args.at(-1)
  dialogs.push(options)
  await dialogHook()
  return { response: dialogResponse, checkboxChecked: false }
}
app.on('browser-window-created', (_event, window) => {
  window.on('show', () => window.hide())
})
require('../electron/main.cjs')
const key = 'personal-command-dashboard-v1'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check, label, limit = 12000) {
  const deadline = Date.now() + limit
  while (Date.now() < deadline) { if (await check()) return; await delay(25) }
  throw new Error(`Timed out: ${label}`)
}
function evaluate(window, code) { return window.webContents.executeJavaScript(code, true) }
function noteWindow(id) { return BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes(`noteId=${id}`)) }
async function readyNote(id) {
  await until(async () => noteWindow(id) && await evaluate(noteWindow(id), 'Boolean(document.querySelector("textarea"))'), `note ${id}`)
  return noteWindow(id)
}
async function edit(window, content) {
  await evaluate(window, `(() => {
    const field = document.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, ${JSON.stringify(content)});
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
}
async function mainTest() {
  await app.whenReady()
  let main
  await until(() => { main = BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('noteId=')); return main }, 'main window')
  await until(async () => await evaluate(main, `Boolean(localStorage.getItem('${key}')) && Boolean(document.querySelector('button'))`), 'main mounted')
  const state = () => evaluate(main, `JSON.parse(localStorage.getItem('${key}'))`)
  if (stage === 'final') {
    const saved = await state()
    assert.equal(saved.desktopNotes.find(note => note.id === 'exit').content, 'rapid exit draft')
    assert.equal(saved.desktopNotes.find(note => note.id === 'multi').content, 'rapid multi draft')
    fs.writeFileSync(path.join(profile, 'final.passed'), '')
    app.quit()
    return
  }
  if (stage === 'crash') {
    const note = await readyNote('exit')
    main.webContents.forcefullyCrashRenderer()
    await until(() => main.webContents.isCrashed(), 'main renderer crashed')
    await edit(note, 'draft survives failed close after crash')
    note.close()
    await until(() => dialogs.length === 1, 'crashed renderer failure dialog')
    assert.equal(note.isDestroyed(), false)
    assert.equal(await evaluate(note, `document.querySelector('textarea').value`), 'draft survives failed close after crash')
    fs.writeFileSync(path.join(profile, 'crash.passed'), '')
    console.log('PASS: main renderer crash preserves note draft')
    app.exit(0)
    return
  }
  if (stage === 'reopen') {
    const saved = await state()
    assert.equal(saved.desktopNotes.find(note => note.id === 'close').content, 'typed immediately before close')
    assert.equal(saved.desktopNotes.find(note => note.id === 'close').isOpen, false)
    assert.equal(saved.desktopNotes.find(note => note.id === 'failure').content, 'recover failed draft')
    assert.equal(saved.desktopNotes.find(note => note.id === 'exit').content, 'exit draft')
    assert.equal(saved.desktopNotes.find(note => note.id === 'multi').content, 'another exit draft')
    assert.equal(saved.desktopNotes.find(note => note.id === 'panel').content, 'main panel pending draft')
    assert.equal(saved.desktopNotes.some(note => note.id === 'delete'), false)
    assert.equal(saved.desktopNotes.some(note => note.id === 'empty'), false)
    assert.equal(saved.tasks.filter(task => task.id === 'note-task:exit:dedup').length, 1)
    const expectedBounds = JSON.parse(fs.readFileSync(path.join(profile, 'bounds.json'), 'utf8'))
    assert.deepEqual(saved.desktopNotes.find(note => note.id === 'close').bounds, expectedBounds)
    await readyNote('exit'); await readyNote('multi')
    assert.equal(noteWindow('close'), undefined)
    await edit(noteWindow('exit'), 'rapid exit draft')
    await edit(noteWindow('multi'), 'rapid multi draft')
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ closeBehavior: 'quit' }))
    app.on('will-quit', () => fs.writeFileSync(path.join(profile, 'reopen.passed'), ''))
    main.close()
    setTimeout(() => app.exit(0), 1200)
    return
  }
  await evaluate(main, `(() => {
    const state = JSON.parse(localStorage.getItem('${key}'));
    state.tasks = []; state.tomorrowTasks = [];
    state.desktopNotes = ['close', 'failure', 'exit', 'multi', 'delete', 'empty', 'panel'].map((id, index) => ({
      id, content: id === 'empty' ? '' : 'initial ' + id, color: 'yellow',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      isOpen: id !== 'panel', alwaysOnTop: false, bounds: { x: 60 + index * 10, y: 60, width: 320, height: 300 }
    }));
    localStorage.setItem('${key}', JSON.stringify(state));
    location.reload();
  })()`)
  const close = await readyNote('close')
  const failure = await readyNote('failure')
  const exit = await readyNote('exit')
  const multi = await readyNote('multi')
  const deletion = await readyNote('delete')
  const empty = await readyNote('empty')
  close.setBounds({ x: 120, y: 140, width: 360, height: 320 })
  const bounds = close.getBounds()
  fs.writeFileSync(path.join(profile, 'bounds.json'), JSON.stringify(bounds))
  await edit(close, 'typed immediately before close')
  close.close()
  await until(() => close.isDestroyed(), 'fast close')
  assert.equal((await state()).desktopNotes.find(note => note.id === 'close').content, 'typed immediately before close')
  console.log('PASS: immediate edit/move/close')
  empty.close()
  await until(() => empty.isDestroyed(), 'empty close')
  await evaluate(deletion, `window.confirm = () => true; document.querySelector('button[title="删除便笺"]').click()`)
  await until(() => deletion.isDestroyed(), 'delete')
  const dedup = await evaluate(exit, `Promise.all([window.commandDeck.runDesktopNoteAction('exit','add-today','dedup'),window.commandDeck.runDesktopNoteAction('exit','add-today','dedup')])`)
  assert.equal(dedup.every(result => result.accepted), true)
  assert.equal((await state()).tasks.length, 1)
  console.log('PASS: delete, empty close and task deduplication')
  await evaluate(main, `window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw new Error('test disk full') }; void 0`)
  await edit(failure, 'recover failed draft')
  failure.close()
  await until(() => dialogs.length === 1, 'save failure dialog')
  assert.equal(dialogs[0].defaultId, 1)
  assert.equal(failure.isDestroyed(), false)
  await until(async () => !(await evaluate(failure, `document.getElementById('root').hasAttribute('inert')`)), 'unfreeze')
  assert.equal(await evaluate(failure, `document.querySelector('textarea').value`), 'recover failed draft')
  assert.match(await evaluate(failure, `document.querySelector('.desktop-note-save-state').textContent`), /保存失败/)
  await evaluate(main, `Storage.prototype.setItem = window.originalSetItem; void 0`)
  await evaluate(failure, `[...document.querySelectorAll('button')].find(button => button.textContent === '重试保存').click()`)
  await until(async () => (await state()).desktopNotes.find(note => note.id === 'failure').content === 'recover failed draft', 'retry saved')
  failure.close()
  await until(() => failure.isDestroyed(), 'close after retry')
  console.log('PASS: failed close preserves draft and retries')
  // 丢弃 ACK 模拟主窗口响应超时，随后恢复并再次退出。
  const ackListeners = ipcMain.listeners('desktop-notes:ack')
  ipcMain.removeAllListeners('desktop-notes:ack')
  const previousDialogs = dialogs.length
  app.quit(); app.quit()
  await until(() => dialogs.length === previousDialogs + 1, 'quit timeout', 10000)
  assert.equal(main.isDestroyed(), false)
  for (const listener of ackListeners) ipcMain.on('desktop-notes:ack', listener)
  await delay(100)
  assert.equal(dialogs.length, previousDialogs + 1)
  console.log('PASS: quit timeout cancels and repeated quit is coalesced')
  await evaluate(main, `Storage.prototype.setItem = function() { throw new Error('test disk full') }; void 0`)
  await edit(exit, 'exit draft')
  await edit(multi, 'another exit draft')
  // 主窗口卡片的未到防抖时间的输入同样必须参与退出保存。
  await evaluate(main, `[...document.querySelectorAll('button')].find(button => button.textContent.includes('推进')).click()`)
  await until(async () => await evaluate(main, `Boolean([...document.querySelectorAll('.desktop-note-card')].find(card => card.textContent.includes('initial panel')))`), 'panel editor')
  await evaluate(main, `(() => {
    const card = [...document.querySelectorAll('.desktop-note-card')].find(card => card.textContent.includes('initial panel'));
    const field = card.querySelector('textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'main panel pending draft');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  dialogResponse = 0
  dialogHook = async () => {
    await evaluate(main, 'Storage.prototype.setItem = window.originalSetItem; void 0')
    dialogHook = async () => {}
  }
  app.on('will-quit', () => fs.writeFileSync(path.join(profile, 'exercise.passed'), ''))
  app.quit()
}
mainTest().catch(error => { console.error(error.stack); app.exit(1) })
