import { observer } from 'mobx-react-lite'
import { useEffect, useMemo, useRef } from 'react'
import { Empty, Spin } from 'antd'
import { KLineChartsAdapter } from '../adapters/KLineChartsAdapter'
import type { KLineChartViewModel } from '../view-models/KLineChartViewModel'

interface KLineChartViewProps {
  viewModel: KLineChartViewModel
  loading: boolean
}

export const KLineChartView = observer(({ viewModel, loading }: KLineChartViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapter = useMemo(() => new KLineChartsAdapter(), [])

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    adapter.mount(containerRef.current)
    const onResize = (): void => adapter.resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      adapter.dispose()
    }
  }, [adapter])

  useEffect(() => {
    if (!viewModel.dataset) {
      return
    }
    adapter.setDataset(viewModel.dataset, viewModel.enabledIndicators)
  }, [adapter, viewModel.dataset, viewModel.enabledIndicators, viewModel.revision])

  return (
    <div className="chart-shell">
      <div ref={containerRef} className="kline-chart" />
      {!viewModel.hasDataset && !loading ? (
        <div className="chart-empty">
          <Empty description="暂无行情数据" />
        </div>
      ) : null}
      {loading ? (
        <div className="chart-loading">
          <Spin tip="正在加载行情数据..." />
        </div>
      ) : null}
    </div>
  )
})
