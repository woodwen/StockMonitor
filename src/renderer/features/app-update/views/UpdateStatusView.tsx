import { Modal, Progress } from 'antd'
import { observer } from 'mobx-react-lite'
import type { AppUpdateViewModel } from '../view-models/AppUpdateViewModel'

interface UpdateStatusViewProps {
  viewModel: AppUpdateViewModel
}

export const UpdateStatusView = observer(({ viewModel }: UpdateStatusViewProps) => {
  const { state } = viewModel
  const progress = Math.round(state.progress?.percent ?? 0)

  return (
    <>
      <Modal
        title="发现新版本"
        open={state.status === 'available'}
        okText="下载更新"
        cancelText="稍后"
        onOk={viewModel.downloadUpdate}
        onCancel={viewModel.dismiss}
      >
        <p>{state.message}</p>
      </Modal>

      <Modal
        title="正在下载更新"
        open={state.status === 'downloading'}
        footer={null}
        closable={false}
      >
        <Progress percent={progress} status="active" />
      </Modal>

      <Modal
        title="更新已下载"
        open={state.status === 'downloaded'}
        okText="立即重启安装"
        cancelText="稍后"
        onOk={viewModel.quitAndInstall}
        onCancel={viewModel.dismiss}
      >
        <p>{state.message}</p>
      </Modal>

      <Modal
        title="更新检查失败"
        open={state.status === 'error'}
        okText="知道了"
        cancelButtonProps={{ style: { display: 'none' } }}
        onOk={viewModel.dismiss}
        onCancel={viewModel.dismiss}
      >
        <p>{state.message}</p>
      </Modal>
    </>
  )
})
