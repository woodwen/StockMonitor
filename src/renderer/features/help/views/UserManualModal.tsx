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
              <li>所有技术指标、策略信号、历史回测和做T测算仅为程序化计算或估算结果。</li>
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
              <li>K 线模式下可以使用“缓存”准备自选股历史 K 线，也可以使用顶部“策略”查看候选策略历史回测。</li>
              <li>顶部“更多”菜单聚合数据源、代理、缓存导入导出和更新检查等低频操作。</li>
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
            <Paragraph>
              K 线和分时使用独立指标配置。K 线指标设置不再提供 <Text code>B/S</Text> 指标项；分时指标设置也不再提供 <Text code>B/S</Text> 指标项。K 线中的 <Text code>策略</Text> 信号默认开启，但只有存在选中成功策略回测结果时才会在图表展示策略买入/卖出标记。
            </Paragraph>
            <ul>
              <li>点击顶部工具栏“指标”打开指标设置。</li>
              <li>K 线和分时使用独立指标配置，互不覆盖。</li>
              <li>指标参数会做范围校验，部分指标要求周期不能重复或快线小于慢线。</li>
              <li>副图指标数量存在上限，超过上限时需要先关闭其他副图指标。</li>
            </ul>
            <Paragraph>
              <Text strong>K 线指标</Text>
            </Paragraph>
            <ul>
              <li><Text code>BOLL</Text>：用收盘价均线作为中轨，并按标准差倍数形成上轨和下轨，用于观察历史波动区间；需要连续 K 线收盘价，样本不足时前段为空。</li>
              <li><Text code>MA</Text>：简单移动平均线，按指定周期计算收盘价均值，用于平滑观察不同周期价格变化；周期越长越滞后。</li>
              <li><Text code>EMA</Text>：指数移动平均线，对近期收盘价赋予更高权重，比同周期 MA 对近期变化更敏感。</li>
              <li><Text code>策略</Text>：显示当前选中且成功回测的策略模板历史信号；它不重新计算策略，只渲染回测结果传入的买入/卖出标记。</li>
              <li><Text code>VOL</Text>：展示成交量柱和成交量均线，用于观察历史成交量变化；成交量缺失或异常时结果会受影响。</li>
              <li><Text code>MACD</Text>：基于快慢 EMA 差值得到 DIF，并用 DIF 的 EMA 得到 DEA，柱体反映二者差值；快线必须小于慢线。</li>
              <li><Text code>KDJ</Text>：基于一定周期内最高价、最低价和收盘价计算 RSV，再平滑得到 K、D、J，用于观察历史相对位置变化；需要 OHLC 数据。</li>
              <li><Text code>RSI</Text>：按指定周期比较上涨和下跌幅度，输出 0-100 区间的相对强弱值；连续单边或横盘数据会让数值靠近边界或中位。</li>
            </ul>
            <Paragraph>
              <Text strong>分时指标</Text>
            </Paragraph>
            <ul>
              <li><Text code>均价线</Text>：使用数据源返回的分时均价，反映当日累计成交均价口径；数据源缺失时不展示。</li>
              <li><Text code>昨收线</Text>：使用 <Text code>previousClose</Text> 作为当日涨跌幅参考线；昨收缺失时相关参考会降级。</li>
              <li><Text code>MA</Text>：对分时价格按分钟序列计算简单移动平均，用于平滑观察当日价格路径。</li>
              <li><Text code>EMA</Text>：对分时价格计算指数移动平均，对最新分钟价格变化更敏感。</li>
              <li><Text code>BOLL</Text>：对分时价格计算均线与标准差通道，用于观察当日价格相对波动区间；样本不足时前段为空。</li>
              <li><Text code>成交量</Text>：展示单分钟成交量柱；不同数据源可能由累计成交量换算得到单分钟增量。</li>
              <li><Text code>VOL MA</Text>：对单分钟成交量计算移动平均，用于观察成交量变化的平滑趋势。</li>
              <li><Text code>量比</Text>：用当前累计成交量与历史成交量基准比较；需要最近有效交易日的成交量基准，缺失时标记不可用。</li>
              <li><Text code>换手率</Text>：用累计成交量除以流通股本计算；缺少正数流通股本时不可用，不使用总股本替代。</li>
              <li><Text code>MACD</Text>：对分时价格计算 DIF、DEA 和 MACD 柱，用于观察当日价格序列的快慢 EMA 差值。</li>
              <li><Text code>KDJ</Text>：基于分钟 OHLC 计算 RSV、K、D、J；缺少分钟 high/low/close 时不可用。</li>
              <li><Text code>RSI</Text>：对分时价格变化计算相对强弱值，反映当日价格序列的上涨/下跌幅度比例。</li>
              <li><Text code>委比</Text>：按买卖前 5 档数量计算 <Text code>(买量 - 卖量) / (买量 + 卖量)</Text>；缺少盘口档位时不可用。</li>
              <li><Text code>内外盘</Text>：使用逐笔方向或数据源聚合字段展示主动买入/卖出方向成交量；不会用价格涨跌方向推断。</li>
              <li><Text code>资金流</Text>：使用逐笔方向或数据源聚合字段展示总流入、总流出和净流入；缺少可靠字段时不可用。</li>
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
              <li>策略模板默认全选，用户可以按需取消模板；默认全选只代表候选模板默认参与比较，不代表投资推荐。</li>
              <li>策略模板会展示类型、基本逻辑和推荐程度；推荐程度只是模板元数据，历史表现排名仍由回测评分决定。</li>
              <li>回测区间使用顶部 K 线日期范围；策略面板不再单独设置开始日期或结束日期。</li>
              <li>运行前需要设置初始资金、费用率和滑点率；缺少历史 K 线缓存时会先准备缓存。</li>
              <li>结果展示历史表现排名、收益和回撤指标、交易明细、信号列表和回测假设。</li>
              <li>K 线 <Text code>策略</Text> 信号指标默认开启；未运行回测、回测失败或没有选中成功结果时，图表不会展示策略买入/卖出标记。</li>
              <li>历史回测不代表未来表现；策略信号只是所选区间内的程序化历史触发点，不构成买卖建议、荐股服务或收益承诺。</li>
            </ul>
            <Paragraph>
              <Text strong>策略模板原理</Text>
            </Paragraph>
            <ul>
              <li><Text code>ma-cross</Text> 均线交叉：类型为趋势跟随，比较短期 MA 与长期 MA；短期线上穿生成历史买入信号，下穿生成历史卖出信号；关键参数是短期/长期均线周期，限制是震荡区间可能反复触发。</li>
              <li><Text code>breakout-pullback</Text> 突破回撤：类型为突破，收盘价突破观察窗口高点时生成历史买入信号，跌破退出均线时生成历史卖出信号；关键参数是观察窗口和退出均线周期，限制是突破失败时可能快速回撤。</li>
              <li><Text code>rsi-reversion</Text> RSI 超买超卖：类型为反转，RSI 从超卖阈值下方修复时生成历史买入信号，进入超买区间时生成历史卖出信号；关键参数是 RSI 周期、超卖阈值和超买阈值，限制是不代表未来反转一定出现。</li>
              <li><Text code>macd-trend-confirmation</Text> MACD 趋势确认：类型为趋势确认，DIF 在零轴上方上穿 DEA 时生成历史买入信号，下穿 DEA 时生成历史卖出信号；关键参数是快线、慢线和信号 EMA，限制是信号通常滞后于价格变化。</li>
              <li><Text code>ma-bullish-alignment</Text> 均线多头排列：类型为趋势，多条均线满足短期高于中长期排列时生成历史买入信号，排列失效或短期均线跌破中期均线时生成历史卖出信号；关键参数是快/短/中/长期均线周期，限制是需要较长样本预热。</li>
              <li><Text code>n-day-high-breakout</Text> N 日新高突破：类型为趋势/突破，收盘价突破过去 N 根 K 线高点时生成历史买入信号，跌破退出均线或突破价时生成历史卖出信号；关键参数是突破观察窗口和退出均线周期，限制是横盘行情可能出现假突破。</li>
              <li><Text code>volume-breakout</Text> 放量突破：类型为量价，价格突破压力位且成交量达到均量倍数阈值时生成历史买入信号，跌破退出均线或突破位时生成历史卖出信号；关键参数是压力位窗口、成交量均线和放量倍数，限制是依赖可靠成交量数据。</li>
              <li><Text code>bollinger-breakout</Text> 布林带突破：类型为波动/趋势，收盘价向上突破 Bollinger 上轨时生成历史买入信号，跌回中轨或突破失效时生成历史卖出信号；关键参数是 Bollinger 周期和标准差倍数，限制是波动放大时通道会同步扩张。</li>
              <li><Text code>bollinger-mean-reversion</Text> 布林带均值回归：类型为反转，价格曾跌破下轨后重新回到通道内时生成历史买入信号，回到中轨或目标通道位置时生成历史卖出信号；关键参数是 Bollinger 周期和标准差倍数，限制是单边趋势中可能持续偏离中轨。</li>
              <li><Text code>kdj-oversold-rebound</Text> KDJ 超卖反弹：类型为反转，K、D 位于低位且 K 上穿 D 时生成历史买入信号，K 下穿 D 或高位回落时生成历史卖出信号；关键参数是 RSV 周期、K/D 平滑和超卖/高位阈值，限制是需要完整 OHLC 数据。</li>
              <li><Text code>atr-trend-following</Text> ATR 趋势跟踪：类型为趋势/波动，趋势过滤成立且收盘价站上 ATR 动态止损参考时生成历史买入信号，跌破动态止损或趋势失效时生成历史卖出信号；关键参数是趋势均线、ATR 周期和 ATR 倍数，限制是高波动阶段止损参考会变宽。</li>
              <li><Text code>low-volume-ma-pullback</Text> 缩量回踩均线：类型为趋势回撤，上涨趋势中价格缩量回踩支撑均线后重新走强时生成历史买入信号，跌破支撑均线或趋势失效时生成历史卖出信号；关键参数是趋势均线、支撑均线、成交量均线、缩量阈值和回踩容忍度，限制是依赖价格与成交量共同满足。</li>
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
              <li>点击顶部“更多”菜单中的“数据源”打开测试和切换弹窗。</li>
              <li>弹窗会展示各数据源请求状态、耗时、记录数和分时能力。</li>
              <li>K 线和分时数据源独立保存，切换一个视图的数据源不会覆盖另一个视图。</li>
              <li>免费网页接口不提供稳定 SLA，请以弹窗测试结果和状态栏提示为准。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-proxy">
            <Title level={4}>网络代理</Title>
            <ul>
              <li>点击顶部“更多”菜单中的“代理”打开网络代理配置。</li>
              <li>默认直连，不读取系统代理环境变量。</li>
              <li>需要代理时可手动启用 SOCKS5 或 HTTP，并配置地址和端口。</li>
              <li>代理设置同时影响行情请求和更新检查。</li>
            </ul>
          </section>

          <section className="manual-section" id="manual-updates">
            <Title level={4}>应用更新</Title>
            <ul>
              <li>
                可通过 <Text code>帮助 -&gt; 检查更新</Text> 或顶部 <Text code>更多 -&gt; 检查更新</Text> 手动检查新版本。
              </li>
              <li>顶部 <Text code>更多 -&gt; 启动检查更新</Text> 控制应用启动后是否自动检查更新。</li>
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
