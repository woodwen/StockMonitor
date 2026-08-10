export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface AppUpdateState {
  status: UpdateStatus
  version?: string
  message?: string
  progress?: UpdateProgress
}

export type AppUpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available'; version?: string }
  | { type: 'progress'; progress: UpdateProgress }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
