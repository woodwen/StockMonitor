import { App, Button, Checkbox, Divider, Empty, Input, Space, Tag, Typography } from 'antd'
import { CopyOutlined, PlusOutlined, StarFilled } from '@ant-design/icons'
import { observer } from 'mobx-react-lite'
import type { WatchlistAddPreviewStatus, WatchlistItem } from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface WatchlistPanelProps {
  stock: StockWorkspaceViewModel
}

const previewStatusMeta: Record<WatchlistAddPreviewStatus, { color: string; label: string }> = {
  ready: { color: 'success', label: '可添加' },
  duplicate: { color: 'default', label: '已存在' },
  invalid: { color: 'error', label: '错误' }
}

export const WatchlistPanel = observer(({ stock }: WatchlistPanelProps) => {
  const { modal } = App.useApp()
  const readyCount = stock.watchlistAddPreview.previews.filter(
    (preview) => preview.status === 'ready'
  ).length
  const duplicateCount = stock.watchlistAddPreview.previews.filter(
    (preview) => preview.status === 'duplicate'
  ).length
  const invalidCount = stock.watchlistAddPreview.previews.filter(
    (preview) => preview.status === 'invalid'
  ).length

  const confirmRemoveSelected = (): void => {
    modal.confirm({
      title: '删除自选股',
      content: `确认删除选中的 ${stock.selectedWatchlistCount} 只自选股？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: stock.removeSelectedWatchlistItems
    })
  }

  const pasteFromClipboard = async (): Promise<void> => {
    try {
      const clipboardText = await navigator.clipboard?.readText()
      if (clipboardText === undefined) {
        stock.setWatchlistPasteError('当前环境不支持读取剪切板')
        return
      }
      stock.appendWatchlistAddText(clipboardText)
    } catch {
      stock.setWatchlistPasteError('读取剪切板失败，请使用 Cmd/Ctrl+V 粘贴')
    }
  }

  return (
    <aside className="watchlist-panel">
      <div className="watchlist-header">
        <Space size={6}>
          <StarFilled />
          <Typography.Text strong>自选股</Typography.Text>
          <Tag>{stock.watchlist.length}</Tag>
        </Space>
        <Button size="small" onClick={stock.toggleWatchlistManageMode}>
          {stock.watchlistManageMode ? '完成' : '管理'}
        </Button>
      </div>

      <div className="watchlist-add">
        <Input.TextArea
          className="watchlist-add-input"
          value={stock.watchlistAddText}
          rows={4}
          maxLength={4000}
          placeholder={'sh600519\n600519 贵州茅台'}
          onChange={(event) => stock.setWatchlistAddText(event.target.value)}
        />
        <Space size={8} wrap>
          <Button size="small" icon={<PlusOutlined />} onClick={stock.addCurrentToWatchlist}>
            添加当前
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={() => void pasteFromClipboard()}>
            粘贴
          </Button>
          <Button
            size="small"
            type="primary"
            disabled={!stock.canAddWatchlistPreview}
            onClick={stock.confirmWatchlistAdditions}
          >
            添加
          </Button>
          <Button size="small" disabled={!stock.watchlistAddText} onClick={() => stock.setWatchlistAddText('')}>
            清空
          </Button>
        </Space>
        {stock.watchlistPasteError ? (
          <Typography.Text className="watchlist-paste-error" type="danger">
            {stock.watchlistPasteError}
          </Typography.Text>
        ) : null}

        {stock.watchlistAddPreview.previews.length > 0 || stock.watchlistAddPreview.truncated ? (
          <div className="watchlist-preview">
            <Space size={6} wrap>
              <Tag color="success">可添加 {readyCount}</Tag>
              <Tag>已存在 {duplicateCount}</Tag>
              <Tag color={invalidCount > 0 ? 'error' : 'default'}>错误 {invalidCount}</Tag>
              {stock.watchlistAddPreview.truncated ? <Tag color="warning">已截断 200 行</Tag> : null}
            </Space>
            <div className="watchlist-preview-list">
              {stock.watchlistAddPreview.previews.map((preview) => {
                const meta = previewStatusMeta[preview.status]
                return (
                  <div
                    key={`${preview.lineNumber}-${preview.raw}`}
                    className="watchlist-preview-row"
                    title={preview.message}
                  >
                    <Tag color={meta.color}>{meta.label}</Tag>
                    <span className="watchlist-preview-symbol">{preview.symbol || '-'}</span>
                    <span className="watchlist-preview-name">{preview.name || preview.raw}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      <Divider className="watchlist-divider" />

      {stock.watchlistManageMode ? (
        <div className="watchlist-manage-bar">
          <Space size={6} wrap>
            <Button size="small" onClick={stock.selectAllWatchlistItems}>
              全选
            </Button>
            <Button size="small" onClick={stock.invertWatchlistSelection}>
              反选
            </Button>
            <Button
              size="small"
              danger
              disabled={!stock.canDeleteSelectedWatchlistItems}
              onClick={confirmRemoveSelected}
            >
              删除 {stock.selectedWatchlistCount}
            </Button>
          </Space>
        </div>
      ) : null}

      <div className="watchlist-list">
        {stock.watchlist.length === 0 ? (
          <Empty className="watchlist-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无自选股" />
        ) : (
          stock.watchlist.map((item) => (
            <WatchlistRow key={item.symbol} stock={stock} item={item} />
          ))
        )}
      </div>
    </aside>
  )
})

interface WatchlistRowProps {
  stock: StockWorkspaceViewModel
  item: WatchlistItem
}

const WatchlistRow = observer(({ stock, item }: WatchlistRowProps) => {
  const active = item.symbol === stock.normalizedCurrentSymbol
  const selected = stock.selectedWatchlistSymbols.includes(item.symbol)
  const displayName = item.name || item.symbol

  return (
    <div
      className={`watchlist-row${active ? ' is-active' : ''}`}
      title={`${displayName} ${item.symbol}`}
      onClick={() => {
        if (!stock.watchlistManageMode) {
          void stock.selectWatchlistItem(item.symbol)
        }
      }}
    >
      {stock.watchlistManageMode ? (
        <Checkbox
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => stock.toggleWatchlistSelection(item.symbol, event.target.checked)}
        />
      ) : null}
      <div className="watchlist-row-main">
        <span className="watchlist-row-name">{displayName}</span>
        <span className="watchlist-row-symbol">{item.symbol}</span>
      </div>
    </div>
  )
})
