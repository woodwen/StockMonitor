import { makeAutoObservable } from 'mobx'

export type ImportStatus = 'idle' | 'loading' | 'success' | 'error'

export class ImportFileViewModel {
  status: ImportStatus = 'idle'
  fileName = ''
  encoding = ''
  error = ''

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  start(fileName = ''): void {
    this.status = 'loading'
    this.fileName = fileName
    this.encoding = ''
    this.error = ''
  }

  succeed(fileName: string, encoding: string): void {
    this.status = 'success'
    this.fileName = fileName
    this.encoding = encoding
    this.error = ''
  }

  fail(error: string): void {
    this.status = 'error'
    this.error = error
  }
}
