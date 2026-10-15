/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import type { Page } from '@playwright/test'

// Picks real files from disk through a hidden input, then fires the drag events a real drop would.
export async function dropFiles(page: Page, paths: string[], events = ['dragenter', 'dragover', 'drop']): Promise<void> {
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.id = 'test-picker'
    input.hidden = true
    document.body.append(input)
  })
  await page.setInputFiles('#test-picker', paths)
  await page.evaluate((types) => {
    const input = document.getElementById('test-picker') as HTMLInputElement
    const data = new DataTransfer()
    for (const file of input.files ?? []) data.items.add(file)
    input.remove()
    for (const type of types) {
      document.body.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }))
    }
  }, events)
}
