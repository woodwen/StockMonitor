import { App as AntdApp, ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useEffect, useMemo } from 'react'
import { WorkspacePage } from '../features/stock-workspace/views/WorkspacePage'
import { RootViewModel } from './RootViewModel'
import '../styles.css'

export function App(): React.ReactElement {
  const root = useMemo(() => new RootViewModel(), [])

  useEffect(() => {
    root.initialize()
    return () => root.dispose()
  }, [root])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
        }
      }}
    >
      <AntdApp>
        <WorkspacePage root={root} />
      </AntdApp>
    </ConfigProvider>
  )
}
