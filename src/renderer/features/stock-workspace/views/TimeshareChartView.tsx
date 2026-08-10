import { Empty, Spin } from 'antd'
import { observer } from 'mobx-react-lite'
import { useEffect, useMemo, useRef } from 'react'
import { TimeshareChartAdapter } from '../adapters/TimeshareChartAdapter'
import type { TimeshareChartViewModel } from '../view-models/TimeshareChartViewModel'

interface TimeshareChartViewProps {
  viewModel: TimeshareChartViewModel
  loading: boolean
}

export const TimeshareChartView = observer(({ viewModel, loading }: TimeshareChartViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapter = useMemo(() => new TimeshareChartAdapter(), [])

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
    adapter.setDataset(viewModel.dataset)
  }, [adapter, viewModel.dataset, viewModel.revision])

  return (
    <div className="chart-shell">
      <div ref={containerRef} className="timeshare-chart" />
      {!viewModel.hasDataset && !loading ? (
        <div className="chart-empty">
          <Empty description="暂无分时数据" />
        </div>
      ) : null}
      {loading ? (
        <div className="chart-loading">
          <Spin tip="正在加载分时数据..." />
        </div>
      ) : null}
    </div>
  )
})
