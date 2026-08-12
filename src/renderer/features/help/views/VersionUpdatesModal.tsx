import type { ReactElement, ReactNode } from 'react'
import { Empty, Modal, Typography } from 'antd'
import changelogMarkdown from '../../../../../CHANGELOG.md?raw'
import { parseChangelog } from '../models/changelog'

const { Paragraph, Text, Title } = Typography

const changelogEntries = parseChangelog(changelogMarkdown)

interface VersionUpdatesModalProps {
  open: boolean
  onClose: () => void
}

export function VersionUpdatesModal({
  open,
  onClose
}: VersionUpdatesModalProps): ReactElement {
  const scrollToEntry = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }

  return (
    <Modal
      className="version-updates-modal"
      title="版本更新说明"
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
    >
      <Paragraph className="version-updates-note">
        内容来自当前安装包内置 <Text code>CHANGELOG.md</Text>；如需检查是否有新版本，请使用{' '}
        <Text code>帮助 -&gt; 检查更新</Text> 或顶部工具栏入口。
      </Paragraph>

      {changelogEntries.length > 0 ? (
        <div className="version-updates-shell">
          <nav className="version-updates-nav" aria-label="版本更新说明目录">
            <Text className="version-updates-nav-title">版本</Text>
            <div className="version-updates-nav-list">
              {changelogEntries.map((entry) => (
                <button
                  className="version-updates-nav-button"
                  key={entry.id}
                  type="button"
                  onClick={() => scrollToEntry(entry.id)}
                >
                  {entry.title}
                </button>
              ))}
            </div>
          </nav>

          <Typography className="version-updates-content">
            {changelogEntries.map((entry) => (
              <section className="version-updates-section" id={entry.id} key={entry.id}>
                <div className="version-updates-section-header">
                  <Title level={4}>{entry.title}</Title>
                  {entry.date ? <Text type="secondary">{entry.date}</Text> : null}
                </div>

                {entry.groups.map((group) => (
                  <div className="version-updates-group" key={`${entry.id}-${group.title}`}>
                    <Title level={5}>{group.title}</Title>
                    <ul>
                      {group.items.map((item, index) => (
                        <li key={`${entry.id}-${group.title}-${index}`}>
                          {renderInlineCode(item.text)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </Typography>
        </div>
      ) : (
        <Empty description="暂无版本更新说明" />
      )}
    </Modal>
  )
}

function renderInlineCode(text: string): ReactNode[] {
  return text
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <Text code key={`${part}-${index}`}>
            {part.slice(1, -1)}
          </Text>
        )
      }

      return <span key={`${part}-${index}`}>{part}</span>
    })
}
