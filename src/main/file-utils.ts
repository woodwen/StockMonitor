import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import iconv from 'iconv-lite'
import type { FileTextPayload } from '../renderer/features/stock-workspace/models/stock-types'

export async function readLegacyTextFile(filePath: string): Promise<FileTextPayload> {
  const buffer = await fs.readFile(filePath)
  const decoded = decodeLegacyText(buffer)
  return {
    filePath,
    fileName: path.basename(filePath),
    text: decoded.text,
    encoding: decoded.encoding
  }
}

export async function readSampleLegacyTextFile(): Promise<FileTextPayload> {
  return readLegacyTextFile(getSampleLegacyFilePath())
}

export function getSampleLegacyFilePath(): string {
  const devPath = path.join(process.cwd(), 'fixtures', 'legacy', '000002.txt')
  const packagedPath = path.join(process.resourcesPath, 'fixtures', 'legacy', '000002.txt')
  return app.isPackaged ? packagedPath : devPath
}

export function decodeLegacyText(buffer: Buffer): { text: string; encoding: string } {
  const utf8Text = iconv.decode(buffer, 'utf8')
  const replacementCount = (utf8Text.match(/\uFFFD/g) ?? []).length

  if (replacementCount === 0) {
    return {
      text: utf8Text,
      encoding: 'utf8'
    }
  }

  return {
    text: iconv.decode(buffer, 'gbk'),
    encoding: 'gbk'
  }
}
