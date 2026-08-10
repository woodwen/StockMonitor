import { Alert, Button, Input, InputNumber, Modal, Select, Space, Switch, Typography } from 'antd'
import { observer } from 'mobx-react-lite'
import type { NetworkProxySettings } from '../../../../preload/stock-api'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface NetworkProxyModalProps {
  stock: StockWorkspaceViewModel
}

const protocolOptions: Array<{ value: NetworkProxySettings['protocol']; label: string }> = [
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'http', label: 'HTTP' }
]

export const NetworkProxyModal = observer(({ stock }: NetworkProxyModalProps) => {
  return (
    <Modal
      title="网络代理"
      open={stock.proxyDialogOpen}
      width={520}
      onCancel={stock.closeProxyDialog}
      footer={[
        <Button key="close" onClick={stock.closeProxyDialog}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={stock.saveProxySettings}>
          保存
        </Button>
      ]}
    >
      <Space className="proxy-settings" direction="vertical" size={14}>
        <Alert
          type="info"
          showIcon
          message="默认直连"
          description="未启用代理时，行情请求不会读取 HTTP_PROXY、HTTPS_PROXY 或 ALL_PROXY 环境变量。"
        />

        <div className="proxy-row">
          <Typography.Text>启用代理</Typography.Text>
          <Switch checked={stock.proxyDraft.enabled} onChange={stock.setProxyEnabled} />
        </div>

        <div className="proxy-grid">
          <Typography.Text>协议</Typography.Text>
          <Select
            value={stock.proxyDraft.protocol}
            options={protocolOptions}
            onChange={stock.setProxyProtocol}
          />

          <Typography.Text>地址</Typography.Text>
          <Input
            value={stock.proxyDraft.host}
            onChange={(event) => stock.setProxyHost(event.target.value)}
          />

          <Typography.Text>端口</Typography.Text>
          <InputNumber
            min={1}
            max={65535}
            value={stock.proxyDraft.port}
            onChange={stock.setProxyPort}
          />
        </div>
      </Space>
    </Modal>
  )
})
