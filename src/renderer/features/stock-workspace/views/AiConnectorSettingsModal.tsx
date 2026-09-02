import {
  Alert,
  AutoComplete,
  Button,
  Divider,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tag,
  Typography
} from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { observer } from 'mobx-react-lite'
import { AI_NON_INVESTMENT_NOTICE } from '../models/ai-models'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface AiConnectorSettingsModalProps {
  stock: StockWorkspaceViewModel
}

export const AiConnectorSettingsModal = observer(({ stock }: AiConnectorSettingsModalProps) => {
  const draft = stock.aiConnectorDraft
  const testResult = stock.aiConnectorTestResult
  const pasteApiKeyFromClipboard = async (): Promise<void> => {
    try {
      const clipboardText = await navigator.clipboard?.readText()
      if (clipboardText === undefined) {
        stock.setAiSettingsError('当前环境不支持读取剪切板')
        return
      }
      stock.setAiApiKeyDraft(clipboardText.trim())
      stock.setAiSettingsError('')
    } catch {
      stock.setAiSettingsError('读取剪切板失败，请使用 Cmd/Ctrl+V 粘贴')
    }
  }

  return (
    <Modal
      title="AI 模型设置"
      open={stock.aiSettingsOpen}
      width={720}
      onCancel={stock.closeAiSettings}
      footer={[
        <Button key="close" onClick={stock.closeAiSettings}>
          关闭
        </Button>,
        <Button key="test" loading={stock.aiSettingsTesting} onClick={stock.testAiSettings}>
          测试连接
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={stock.aiSettingsSaving}
          onClick={stock.saveAiSettings}
        >
          保存
        </Button>
      ]}
    >
      <Space className="ai-settings-shell" direction="vertical" size={14}>
        <Alert
          type="info"
          showIcon
          message="AI 默认禁用，所有分析都需要手动触发"
          description={`renderer 不保存密钥，也不直接请求模型 endpoint。${AI_NON_INVESTMENT_NOTICE}。`}
        />

        {stock.aiSettingsError ? (
          <Alert type="error" showIcon message={stock.aiSettingsError} />
        ) : null}

        <div className="ai-settings-grid">
          <Typography.Text>启用</Typography.Text>
          <Switch checked={draft.enabled} onChange={stock.setAiConnectorEnabled} />

          <Typography.Text>显示名称</Typography.Text>
          <Input
            value={draft.displayName}
            onChange={(event) => stock.setAiConnectorDisplayName(event.target.value)}
          />

          <Typography.Text>model</Typography.Text>
          <AutoComplete
            allowClear
            filterOption={(inputValue, option) =>
              String(option?.value ?? '').toLowerCase().includes(inputValue.toLowerCase())
            }
            options={stock.aiConnectorModelOptions.map((model) => ({
              value: model
            }))}
            placeholder="例如 deepseek-v4-pro / MiniMax-M2.7 / glm-5.2"
            value={draft.model}
            onChange={stock.setAiConnectorModel}
          />

          <Typography.Text>profile</Typography.Text>
          <Input
            placeholder="可选，用于标记模型配置"
            value={draft.profile}
            onChange={(event) => stock.setAiConnectorProfile(event.target.value)}
          />

          <Typography.Text>温度</Typography.Text>
          <InputNumber<number>
            min={0}
            max={2}
            step={0.1}
            value={draft.temperature}
            onChange={stock.setAiConnectorTemperature}
          />

          <Typography.Text>超时秒数</Typography.Text>
          <InputNumber<number>
            min={5}
            max={300}
            step={5}
            value={Math.round(draft.timeoutMs / 1000)}
            onChange={stock.setAiConnectorTimeoutSeconds}
          />

          <Typography.Text>上下文字符</Typography.Text>
          <InputNumber<number>
            min={1000}
            max={60000}
            step={1000}
            value={draft.contextLimit}
            onChange={stock.setAiConnectorContextLimit}
          />
        </div>

        <Divider />

        <div className="ai-settings-grid">
          <Typography.Text>provider</Typography.Text>
          <Select
            value={draft.httpProvider.presetId}
            options={stock.aiConnectorSnapshot.presets.httpProviders.map((preset) => ({
              value: preset.id,
              label: preset.displayName
            }))}
            onChange={stock.setAiHttpProviderPreset}
          />

          <Typography.Text>base URL</Typography.Text>
          <Input
            value={draft.httpProvider.baseUrl}
            onChange={(event) => stock.setAiHttpProviderBaseUrl(event.target.value)}
          />

          <Typography.Text>API key</Typography.Text>
          <Space.Compact className="ai-api-key-row">
            <Input.Password
              value={stock.aiApiKeyDraft}
              placeholder={stock.aiSettingsCredentialLabel}
              onChange={(event) => stock.setAiApiKeyDraft(event.target.value)}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text')
                if (text) {
                  event.preventDefault()
                  stock.setAiApiKeyDraft(text.trim())
                  stock.setAiSettingsError('')
                }
              }}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => void pasteApiKeyFromClipboard()}
            >
              粘贴
            </Button>
            <Button onClick={stock.clearAiApiKey} loading={stock.aiSettingsSaving}>
              清除
            </Button>
          </Space.Compact>
        </div>

        <Space size={8} wrap>
          <Tag>{stock.aiConnectorStatusLabel}</Tag>
          <Tag>{stock.aiSettingsCredentialLabel}</Tag>
          {testResult ? (
            <Tag color={testResult.status === 'available' ? 'success' : 'error'}>
              {testResult.message}
            </Tag>
          ) : null}
        </Space>
      </Space>
    </Modal>
  )
})
