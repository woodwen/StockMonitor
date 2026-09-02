import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  getAiAnalysisDisplayOutput,
  getAiAnalysisResultErrorMessage
} from '../src/renderer/features/stock-workspace/views/AiAnalysisPanel'
import type { AiAnalysisResult } from '../src/renderer/features/stock-workspace/models/ai-models'

describe('AiAnalysisPanel', () => {
  it('shows the provider error message when an AI analysis result fails', () => {
    const result: AiAnalysisResult = {
      status: 'error',
      useCaseId: 'daily-review',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      outputText: '',
      warnings: ['仅供信息整理和历史数据解释，不构成投资建议'],
      errorMessage: 'HTTP provider 请求超时',
      elapsedMs: 60026,
      completedAt: '2026-08-26T13:17:50.000Z'
    }

    expect(getAiAnalysisResultErrorMessage(result)).toBe('HTTP provider 请求超时')
  })

  it('shows partial streamed output until the final result is available', () => {
    const result: AiAnalysisResult = {
      status: 'success',
      useCaseId: 'daily-review',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      outputText: '最终结果',
      warnings: [],
      elapsedMs: 20,
      completedAt: '2026-08-26T13:17:50.000Z'
    }

    expect(getAiAnalysisDisplayOutput('实时片段', null)).toBe('实时片段')
    expect(getAiAnalysisDisplayOutput('实时片段', result)).toBe('最终结果')
  })

  it('formats JSON AI analysis output into readable sections', () => {
    const result: AiAnalysisResult = {
      status: 'success',
      useCaseId: 'daily-review',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      outputText: JSON.stringify({
        generatedAt: '2026-09-02 12:00',
        marketSummary: '缩量震荡',
        missingData: ['新闻摘要缺失']
      }),
      warnings: [],
      elapsedMs: 20,
      completedAt: '2026-08-26T13:17:50.000Z'
    }

    const output = getAiAnalysisDisplayOutput('', result)

    expect(output).toContain('生成时间')
    expect(output).toContain('市场概况')
    expect(output).toContain('- 新闻摘要缺失')
    expect(output).not.toContain('"marketSummary"')
  })

  it('formats high-risk use case JSON fields into Chinese readable labels', () => {
    const result: AiAnalysisResult = {
      status: 'success',
      useCaseId: 'parameter-optimization',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      outputText: JSON.stringify({
        strategyName: '均线交叉',
        candidateParameters: ['短均线 5，长均线 20'],
        localBacktestRequired: true,
        scope: '当前自选股',
        dataNeeds: ['日线缓存']
      }) + '\n\n本地批量回测验证\n- 1. 短均线候选：收益 1.20%',
      warnings: [],
      elapsedMs: 20,
      completedAt: '2026-08-26T13:17:50.000Z'
    }

    const output = getAiAnalysisDisplayOutput('', result)

    expect(output).toContain('策略名称')
    expect(output).toContain('候选参数')
    expect(output).toContain('本地回测要求')
    expect(output).toContain('标的范围')
    expect(output).toContain('数据需求')
    expect(output).toContain('本地批量回测验证')
    expect(output).toContain('短均线候选')
    expect(output).not.toContain('"candidateParameters"')
  })

  it('uses a modal container for AI analysis instead of a side drawer', () => {
    const source = readFileSync(
      new URL('../src/renderer/features/stock-workspace/views/AiAnalysisPanel.tsx', import.meta.url),
      'utf8'
    )

    expect(source).toContain('<Modal')
    expect(source).toContain('className="ai-analysis-modal"')
    expect(source).toContain('AI 分析（测试中）')
    expect(source).not.toContain('<Drawer')
  })

  it('shows the current-only analysis scope in the modal copy', () => {
    const source = readFileSync(
      new URL('../src/renderer/features/stock-workspace/views/AiAnalysisPanel.tsx', import.meta.url),
      'utf8'
    )

    expect(source).toContain('当前仅分析')
    expect(source).toContain('aiCurrentAnalysisScope')
  })
})
