import { Anchor, Box, Button, Container, Divider, Flex, Image, Popover, Stack, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconAlertTriangle,
  IconChevronRight,
  IconClipboard,
  IconFileText,
  IconHome,
  IconMail,
  IconMessage2,
  IconPencil,
} from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { Fragment, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import BrandGithub from '@/components/icons/BrandGithub'
import BrandRedNote from '@/components/icons/BrandRedNote'
import BrandWechat from '@/components/icons/BrandWechat'
import Page from '@/components/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import useVersion from '@/hooks/useVersion'
import platform from '@/platform'
import iconPNG from '@/static/icon.png'
import IMG_WECHAT_QRCODE from '@/static/wechat_qrcode.png'
import { languageAtom } from '@/stores/atoms'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t, i18n: _i18n } = useTranslation()
  const version = useVersion()
  const language = useAtomValue(languageAtom)
  const isSmallScreen = useIsSmallScreen()

  return (
    <Page title={t('About')}>
      <Container size="md" p={0}>
        <Stack gap="xxl" px={isSmallScreen ? 'sm' : 'md'} py={isSmallScreen ? 'xl' : 'md'}>
          <Flex gap="xxl" p="md" className="rounded-lg bg-[var(--mantine-color-chatbox-background-secondary-text)]">
            
            <Stack flex={1} gap="xxs">
              <Flex justify="space-between" align="center">
                <Title order={5} lh={1.5}>
                  Chatbox {/\d/.test(version.version) ? `(v${version.version})` : ''}
                </Title>
              </Flex>
              <Text c="chatbox-tertiary">
                温度（Temperature）（0-2）：控制模型生成文本的创造性和随机性。较高的温度值会使输出更随机、更具创造性，而较低的温度值则更稳定、更确定。
Top P（Top P）（0-1）：控制模型生成文本的多样性。较高的Top P值会使输出更随机、更具多样性，而较低的Top P值则更稳定、更确定。
话题频率（Frequency Penalty）（-2-2）：控制模型生成文本的重复性。较高的频率惩罚值会使模型避免重复生成相同的词汇，而较低的频率惩罚值则允许重复生成相同的词汇。
              </Text>

              <Flex gap="sm">
                <Anchor
                  size="sm"
                  href="https://chatboxai.app/privacy"
                  target="_blank"
                  underline="hover"
                  c="chatbox-tertiary"
                >
                  {t('Privacy Policy')}
                </Anchor>
                <Anchor
                  size="sm"
                  href="https://chatboxai.app/terms"
                  target="_blank"
                  underline="hover"
                  c="chatbox-tertiary"
                >
                  {t('User Terms')}
                </Anchor>
              </Flex>
            </Stack>
          </Flex>

          <List>
            <ListItem
              icon={<BrandGithub className="w-full h-full" />}
              title={t('Github')}
              link="https://github.com/chatboxai/chatbox"
              value="chatbox"
            />
            {/* <ListItem
              icon={<BrandX className="w-full h-full" />}
              title={t('X(Twitter)')}
              link="https://x.com/ChatboxAI_HQ"
              value="@ChatboxAI_HQ"
            /> */}
            <ListItem
              icon={<BrandRedNote className="w-full h-full" />}
              title={t('RedNote')}
              link="https://www.xiaohongshu.com/user/profile/67b581b6000000000e01d11f"
              value="@63844903136"
            />
            <ListItem icon={<BrandWechat className="w-full h-full" />} title={t('WeChat')} right={<WechatQRCode />} />
          </List>

          <List>
            <ListItem
              icon={<IconHome className="w-full h-full" />}
              title={t('Homepage')}
              link={`https://chatboxai.app/redirect_app/homepage/${language}`}
            />
            <ListItem
              icon={<IconClipboard className="w-full h-full" />}
              title={t('Survey')}
              link={_i18n.language === 'zh-Hans' ? 'https://jsj.top/f/fcMYEa' : 'https://jsj.top/f/RUMbvY'}
            />
            <ListItem
              icon={<IconPencil className="w-full h-full" />}
              title={t('Feedback')}
              link={`https://chatboxai.app/redirect_app/feedback/${language}`}
            />
            <ListItem
              icon={<IconFileText className="w-full h-full" />}
              title={t('Changelog')}
              link={`https://chatboxai.app/${language.split('-')[0] || 'en'}/help-center/changelog`}
            />
            <ListItem
              icon={<IconMail className="w-full h-full" />}
              title={t('E-mail')}
              link={`mailto:hi@chatboxai.com`}
              value="hi@chatboxai.com"
            />
            <ListItem
              icon={<IconMessage2 className="w-full h-full" />}
              title={t('FAQs')}
              link={`https://chatboxai.app/${language.split('-')[0] || 'en'}/help-center/chatbox-ai-service-faqs`}
            />
          </List>
        </Stack>

        {/* 开发环境下显示错误测试面板 */}
        {/* {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 max-w-md">
            <ErrorTestPanel />
          </div>
        )} */}
      </Container>
    </Page>
  )
}

function WechatQRCode() {
  const { t } = useTranslation()
  const [opened, { close, open }] = useDisclosure(false)
  return (
    <Popover position="top" withArrow shadow="md" opened={opened}>
      <Popover.Target>
        <Text onMouseEnter={open} onMouseLeave={close} c="chatbox-brand" className="cursor-pointer">
          {t('QR Code')}
        </Text>
      </Popover.Target>
      <Popover.Dropdown style={{ pointerEvents: 'none' }}>
        <Image src={IMG_WECHAT_QRCODE} alt="wechat qrcode" w={160} h={160} />
      </Popover.Dropdown>
    </Popover>
  )
}

function List(props: { children: ReactElement[] }) {
  return (
    <Stack gap={0} className="rounded-lg bg-[var(--mantine-color-chatbox-background-secondary-text)]">
      {props.children.map((child, index) => (
        <Fragment key={`child-${index}`}>
          {child}
          {index !== props.children.length - 1 && <Divider />}
        </Fragment>
      ))}
    </Stack>
  )
}

function ListItem({
  icon,
  title,
  link,
  value,
  right,
}: {
  icon: ReactElement
  title: string
  link?: string
  value?: string
  right?: ReactElement
}) {
  return (
    <Flex
      px="md"
      py="sm"
      gap="xs"
      align="center"
      className={link ? 'cursor-pointer' : ''}
      onClick={() => link && platform.openLink(link)}
      c="chatbox-tertiary"
    >
      <Box w={20} h={20} className="flex-shrink-0 " c="chatbox-primary">
        {icon}
      </Box>
      <Text flex={1} size="md">
        {title}
      </Text>

      {right ? (
        right
      ) : (
        <>
          {value && (
            <Text size="md" c="chatbox-tertiary">
              {value}
            </Text>
          )}
          {link && <IconChevronRight size={20} className="!text-inherit" />}
        </>
      )}
    </Flex>
  )
}
