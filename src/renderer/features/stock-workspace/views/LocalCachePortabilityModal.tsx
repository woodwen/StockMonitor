import { Alert, Descriptions, Modal, Radio, Space, Typography } from 'antd'
import { observer } from 'mobx-react-lite'
import type {
  LocalCacheBackupImportStrategy,
  LocalCacheBackupSummary
} from '../../../../preload/stock-api'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface LocalCachePortabilityModalProps {
  stock: StockWorkspaceViewModel
}

export const LOCAL_CACHE_IMPORT_STRATEGY_OPTIONS: Array<{
  label: string
  value: LocalCacheBackupImportStrategy
}> = [
  { label: '合并导入', value: 'merge' },
  { label: '覆盖导入', value: 'replace' }
]

export function getLocalCacheImportOkText(strategy: LocalCacheBackupImportStrategy): string {
  return strategy === 'replace' ? '覆盖导入' : '导入'
}

export function isLocalCacheImportDanger(strategy: LocalCacheBackupImportStrategy): boolean {
  return strategy === 'replace'
}

export const LocalCachePortabilityModal = observer(
  ({ stock }: LocalCachePortabilityModalProps) => {
    const inspect = stock.localCacheBackupInspect
    const result = stock.localCacheBackupResult

    return (
      <>
        <Modal
          title="导入本地缓存"
          open={stock.localCacheImportDialogOpen}
          okText={getLocalCacheImportOkText(stock.localCacheImportStrategy)}
          cancelText="取消"
          okButtonProps={{
            danger: isLocalCacheImportDanger(stock.localCacheImportStrategy)
          }}
          confirmLoading={stock.localCacheImporting}
          onOk={() => void stock.confirmLocalCacheImport()}
          onCancel={stock.closeLocalCacheImportDialog}
        >
          {inspect?.summary ? (
            <div className="local-cache-portability-shell">
              <Typography.Text type="secondary">{inspect.filePath}</Typography.Text>
              <BackupSummary summary={inspect.summary} />
              {inspect.summary.includesNetworkProxy ? (
                <Alert
                  type="warning"
                  showIcon
                  message="导入后会恢复备份中的网络代理配置"
                />
              ) : null}
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={LOCAL_CACHE_IMPORT_STRATEGY_OPTIONS}
                value={stock.localCacheImportStrategy}
                onChange={(event) =>
                  stock.setLocalCacheImportStrategy(
                    event.target.value as LocalCacheBackupImportStrategy
                  )
                }
              />
              {stock.localCacheImportStrategy === 'replace' ? (
                <Alert
                  type="error"
                  showIcon
                  message="覆盖导入会移除备份中未包含的本地 K 线缓存 series"
                />
              ) : null}
            </div>
          ) : null}
        </Modal>

        <Modal
          title={result?.status === 'success' ? '本地缓存操作完成' : '本地缓存操作失败'}
          open={stock.localCacheResultDialogOpen}
          footer={null}
          onCancel={stock.closeLocalCacheResultDialog}
        >
          {result ? (
            <div className="local-cache-portability-shell">
              {result.status === 'success' ? (
                <Alert type="success" showIcon message="操作已完成" />
              ) : (
                <Alert type="error" showIcon message={result.message || '操作失败'} />
              )}
              {'filePath' in result && result.filePath ? (
                <Typography.Text type="secondary">{result.filePath}</Typography.Text>
              ) : null}
              {result.summary ? <BackupSummary summary={result.summary} /> : null}
            </div>
          ) : null}
        </Modal>
      </>
    )
  }
)

export function formatLocalCacheBackupSettingsSections(sections: string[]): string {
  if (sections.length === 0) {
    return '无'
  }
  return sections.map(formatSettingsSection).join('、')
}

export function createLocalCacheBackupSummaryItems(summary: LocalCacheBackupSummary): Array<{
  key: string
  label: string
  children: string
}> {
  return [
    {
      key: 'settings',
      label: '设置分区',
      children: formatLocalCacheBackupSettingsSections(summary.settingsSections)
    },
    {
      key: 'kline',
      label: 'K 线缓存',
      children: `${summary.klineCacheEntryCount} 条`
    },
    {
      key: 'bytes',
      label: '缓存体积',
      children: formatBytes(summary.klineCacheBytes)
    },
    {
      key: 'skipped',
      label: '跳过项',
      children: `${summary.skippedCount} 项`
    }
  ]
}

const BackupSummary = ({ summary }: { summary: LocalCacheBackupSummary }) => {
  const skipped = summary.skippedItems.slice(0, 3)
  return (
    <Space direction="vertical" size={10} className="local-cache-summary">
      <Descriptions
        size="small"
        column={1}
        items={createLocalCacheBackupSummaryItems(summary)}
      />
      {skipped.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message={skipped.map((item) => item.reason).join('；')}
        />
      ) : null}
    </Space>
  )
}

function formatSettingsSection(section: string): string {
  const labels: Record<string, string> = {
    checkUpdatesOnStartup: '启动检查更新',
    networkProxy: '网络代理',
    workspace: '工作区',
    tradeProfit: '做T测算',
    aiConnector: 'AI 设置'
  }
  return labels[section] ?? section
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
