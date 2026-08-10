import { observer } from 'mobx-react-lite'
import { Button, Checkbox, Divider, Space, Switch, Tooltip } from 'antd'
import {
  CloudDownloadOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import type { IndicatorName } from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'
import type { AppUpdateViewModel } from '../../app-update/view-models/AppUpdateViewModel'

interface TopToolbarProps {
  stock: StockWorkspaceViewModel
  updates: AppUpdateViewModel
}

const indicatorLabels: Array<{ name: IndicatorName; label: string }> = [
  { name: 'boll', label: 'BOLL' },
  { name: 'volumeMa', label: 'VOL MA' },
  { name: 'bsSignal', label: 'B/S' }
]

export const TopToolbar = observer(({ stock, updates }: TopToolbarProps) => {
  const importLoading = stock.importFile.status === 'loading'

  const handleIndicatorChange = (name: IndicatorName) => (event: CheckboxChangeEvent): void => {
    stock.toggleIndicator(name, event.target.checked)
  }

  return (
    <div className="top-toolbar">
      <Space size={8}>
        <Tooltip title="导入旧版行情文本">
          <Button
            icon={<FolderOpenOutlined />}
            type="primary"
            loading={importLoading}
            onClick={stock.openFile}
          >
            导入
          </Button>
        </Tooltip>
        <Tooltip title="重新加载项目内示例数据">
          <Button icon={<FileTextOutlined />} onClick={stock.loadSample}>
            示例
          </Button>
        </Tooltip>
        <Tooltip title="检查应用更新">
          <Button icon={<ReloadOutlined />} onClick={updates.checkForUpdates}>
            检查更新
          </Button>
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      <Space size={12}>
        {indicatorLabels.map((item) => (
          <Checkbox
            key={item.name}
            checked={stock.chart.enabledIndicators[item.name]}
            onChange={handleIndicatorChange(item.name)}
          >
            {item.label}
          </Checkbox>
        ))}
      </Space>

      <div className="toolbar-spacer" />

      <Space size={12}>
        <Space size={6}>
          <CloudDownloadOutlined />
          <span className="subtle-text">启动检查更新</span>
          <Switch
            size="small"
            checked={updates.settings.checkUpdatesOnStartup}
            onChange={updates.setCheckUpdatesOnStartup}
          />
        </Space>
        <Tooltip title="清理最近文件">
          <Button icon={<SettingOutlined />} onClick={stock.clearRecentFiles}>
            清理记录
          </Button>
        </Tooltip>
      </Space>
    </div>
  )
})
