import { Modal, Typography } from 'antd'

const { Paragraph, Text, Title } = Typography

interface UserManualModalProps {
  open: boolean
  onClose: () => void
}

const manualSections = [
  { id: 'manual-disclaimer', label: '免责声明' },
  { id: 'manual-quick-start', label: '快速开始' },
  { id: 'manual-symbol', label: '证券代码' },
  { id: 'manual-timeshare', label: '分时视图' },
  { id: 'manual-kline', label: 'K 线视图' },
  { id: 'manual-indicators', label: '指标设置' },
  { id: 'manual-watchlist', label: '自选股' },
  { id: 'manual-kline-cache', label: 'K 线缓存' },
  { id: 'manual-strategy', label: '策略回测' },
  { id: 'manual-trade-profit', label: '做T测算' },
  { id: 'manual-sources', label: '数据源' },
  { id: 'manual-proxy', label: '网络代理' },
  { id: 'manual-updates', label: '应用更新' },
  { id: 'manual-faq', label: '常见问题' }
] as const

export function UserManualModal({ open, onClose }: UserManualModalProps): React.ReactElement {
  const scrollToSection = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }

  return (
    <Modal
      className="user-manual-modal"
      title="使用说明书"
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
    >
      <div className="user-manual-shell">
        <nav className="user-manual-nav" aria-label="使用说明书目录">
          <Text className="manual-nav-title">目录</Text>
          <div className="manual-nav-list">
            {manualSections.map((section) => (
              <button
                className="manual-nav-button"
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        <Typography className="user-manual-content">
          <section className="manual-section" id="manual-disclaimer">
            <Title level={4}>免责声明</Title>
            <Paragraph>
              Stock Monitor 仅用于个人学习、技术研究和行情展示验证。应用内行情数据来自公开网页接口或第三方服务，可能存在延迟、缺失、错误、接口变更、访问受限或服务不可用等情况。
            </Paragraph>
            <ul>
              <li>所有技术指标、B/S 标记、策略信号、历史回测和做T测算仅为程序化计算或估算结果。</li>
              <li>应用不构成投资建议、交易建议、荐股服务或收益承诺。</li>
              <li>用户应自行核验数据，并独立承担投资和使用风险。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-quick-start">
            <Title level={4}>快速开始</Title>
            <ul>
              <li>在顶部输入框输入证券代码，例如 <Text code>sh000001</Text> 或 <Text code>sh600519</Text>。</li>
              <li>按 Enter 或点击“刷新”，加载当前视图对应的远端行情。</li>
              <li>使用“分时 / K线”切换视图；分时和 K 线会分别保存数据源选择。</li>
              <li>K 线模式下可以使用“缓存”准备自选股历史 K 线，也可以使用“策略”查看候选策略历史回测。</li>
              <li>通过底部状态栏查看当前数据源、证券代码、记录数、加载状态和更新状态。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-symbol">
            <Title level={4}>证券代码</Title>
            <Paragraph>
              证券代码支持 <Text code>sh</Text>、<Text code>sz</Text>、<Text code>bj</Text> 前缀。指数代码建议显式输入前缀，避免 <Text code>000001</Text> 同时代表不同证券时产生歧义。
            </Paragraph>
            <ul>
              <li><Text code>sh000001</Text>：上证指数。</li>
              <li><Text code>sz399001</Text>：深证成指。</li>
              <li><Text code>sh600519</Text>：沪市股票。</li>
              <li><Text code>sz000001</Text>：深市股票。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-timeshare">
            <Title level={4}>分时视图</Title>
            <ul>
              <li>分时图展示价格线、均价线、昨收线、成交量和分时指标。</li>
              <li>鼠标移动到图表上可查看十字线、tooltip 和分区图例。</li>
              <li>窗口可见且处于 A 股交易时段时，分时视图会自动静默刷新。</li>
              <li>分时视图只允许切换到声明支持分时能力的数据源。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-kline">
            <Title level={4}>K 线视图</Title>
            <ul>
              <li>K 线支持日线、周线、月线和 5/15/30/60 分钟周期。</li>
              <li>可选择不复权、前复权和后复权；不支持复权的数据源会自动收敛到不复权。</li>
              <li>可调整日期范围后手动刷新。</li>
              <li>主图和副图指标由“指标”弹窗统一管理。</li>
              <li>日线、周线和月线可用于历史 K 线缓存和策略回测；分钟 K 线暂不参与策略回测。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-indicators">
            <Title level={4}>指标设置</Title>
            <ul>
              <li>点击顶部工具栏“指标”打开指标设置。</li>
              <li>K 线和分时使用独立指标配置，互不覆盖。</li>
              <li>K 线指标中 <Text code>B/S</Text> 默认开启，<Text code>策略</Text> 默认关闭；开启其中一个会关闭另一个，避免图表同时展示两套买入/卖出标记。</li>
              <li>指标参数会做范围校验，部分指标要求周期不能重复或快线小于慢线。</li>
              <li>副图指标数量存在上限，超过上限时需要先关闭其他副图指标。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-watchlist">
            <Title level={4}>自选股</Title>
            <ul>
              <li>点击顶部工具栏“自选”打开或收起左侧自选股栏。</li>
              <li>支持单只添加、批量粘贴、管理模式删除所选。</li>
              <li>可按股票名称、完整代码或裸代码搜索筛选自选股；搜索词不保存，关闭自选股栏后会清空。</li>
              <li>点击自选股会切换当前证券代码，并按当前视图刷新行情。</li>
              <li>在自选股栏点击“缓存”，可以查看和刷新当前证券或自选股的历史 K 线缓存。</li>
              <li>自选股列表保存到本地设置，应用重启后会恢复。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-kline-cache">
            <Title level={4}>K 线缓存</Title>
            <ul>
              <li>在自选股栏点击“缓存”打开历史 K 线缓存弹窗。</li>
              <li>弹窗每次打开默认使用“单只股票缓存”，只针对当前证券，不记忆上次模式；当前证券不在自选股列表中也可以缓存。</li>
              <li>默认只勾选日线和前复权；周线、月线、不复权和后复权需要手动勾选。</li>
              <li>可切换“多只股票缓存”，按当前自选股列表批量查询缓存完整性；自选股为空时不会提交批量刷新任务。</li>
              <li>可按数据源、日线/周线/月线、前复权/不复权/后复权和日期范围查询缓存完整性。</li>
              <li>弹窗按证券与周期、复权组合展示数据源、状态、记录数、缓存范围、缺失范围和最近刷新时间。</li>
              <li>支持刷新全部或刷新选中组合；“刷新全部”在单只模式只刷新当前证券，在多只模式刷新当前自选股列表。任务运行时可查看进度，也可取消剩余任务。</li>
              <li>支持清理选中组合的缓存；清理缓存不会删除自选股，也不会替换当前图表数据。</li>
              <li>缓存数据保存在本地应用数据目录，免费网页接口仍可能因为网络或接口变化导致刷新失败。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-strategy">
            <Title level={4}>策略回测</Title>
            <ul>
              <li>K 线模式下点击顶部工具栏“策略”打开 K 线历史回测面板。</li>
              <li>第一版支持日线、周线和月线，暂不支持 5/15/30/60 分钟 K 线回测。</li>
              <li>可比较均线交叉、突破回撤、RSI 超买超卖、MACD 趋势确认，以及均线多头排列、N 日新高突破、放量突破、布林带突破、布林带均值回归、KDJ 超卖反弹、ATR 趋势跟踪、缩量回踩均线等候选策略。</li>
              <li>策略模板会展示类型、基本逻辑和推荐程度；推荐程度只是模板元数据，历史表现排名仍由回测评分决定。</li>
              <li>回测区间使用顶部 K 线日期范围；策略面板不再单独设置开始日期或结束日期。</li>
              <li>运行前需要设置初始资金、费用率和滑点率；缺少历史 K 线缓存时会先准备缓存。</li>
              <li>结果展示历史表现排名、收益和回撤指标、交易明细、信号列表和回测假设。</li>
              <li>如需在图表展示选中策略的历史买入/卖出标记，需要在 K 线指标中开启 <Text code>策略</Text>；该开关与 <Text code>B/S</Text> 互斥。</li>
              <li>历史回测不代表未来表现；策略信号只是所选区间内的程序化历史触发点，不构成买卖建议、荐股服务或收益承诺。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-trade-profit">
            <Title level={4}>做T测算</Title>
            <ul>
              <li>点击顶部工具栏“做T”打开右侧盈亏测算面板。</li>
              <li>输入买入价、卖出价、股数、手续费、印花税和最低佣金后，面板会实时展示费用明细和本次盈亏。</li>
              <li>ETF 交易不会扣除印花税；普通股票会按卖出金额和印花税费率测算。</li>
              <li>点击“新增记录”可把当前测算结果加入历史记录，并按全部记录汇总总盈亏。</li>
              <li>草稿输入和最近 200 条测算记录会保存到本地设置，应用重启后恢复。</li>
              <li>测算结果仅基于输入参数计算，不代表真实成交结果，也不构成投资建议或收益承诺。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-sources">
            <Title level={4}>数据源</Title>
            <ul>
              <li>点击顶部工具栏“数据源”打开测试和切换弹窗。</li>
              <li>弹窗会展示各数据源请求状态、耗时、记录数和分时能力。</li>
              <li>K 线和分时数据源独立保存，切换一个视图的数据源不会覆盖另一个视图。</li>
              <li>免费网页接口不提供稳定 SLA，请以弹窗测试结果和状态栏提示为准。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-proxy">
            <Title level={4}>网络代理</Title>
            <ul>
              <li>点击顶部工具栏“代理”打开网络代理配置。</li>
              <li>默认直连，不读取系统代理环境变量。</li>
              <li>需要代理时可手动启用 SOCKS5 或 HTTP，并配置地址和端口。</li>
              <li>代理设置同时影响行情请求和更新检查。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-updates">
            <Title level={4}>应用更新</Title>
            <ul>
              <li>
                可通过 <Text code>帮助 -&gt; 检查更新</Text> 或顶部工具栏“检查更新”手动检查新版本。
              </li>
              <li>“启动检查更新”开关控制应用启动后是否自动检查更新。</li>
              <li>有新版本时应用会提示下载；下载完成后可选择重启安装。</li>
              <li>macOS 未签名构建会打开 GitHub Release 下载页，需要手动下载 DMG 安装。</li>
              <li>开发环境不会真实安装更新，只展示状态流。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-faq">
            <Title level={4}>常见问题</Title>
            <ul>
              <li>无数据：检查证券代码、当前视图、数据源能力和日期范围。</li>
              <li>请求失败：打开“数据源”弹窗测试其他数据源，或检查网络代理配置。</li>
              <li>分时没有自动刷新：确认窗口可见、处于交易时段，且当前视图为分时。</li>
              <li>更新检查失败：检查网络、GitHub Releases 可访问性和代理配置。</li>
            </ul>
          </section>
        </Typography>
      </div>
    </Modal>
  )
}
