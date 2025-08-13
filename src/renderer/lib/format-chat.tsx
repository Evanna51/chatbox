import Markdown from '@/components/Markdown'
import { SessionThread } from '../../shared/types'
import ReactDOMServer from 'react-dom/server'
import storage from '@/storage'
import * as base64 from '@/packages/base64'
import { getMessageText } from '@/utils/message'

export function formatChatAsMarkdown(sessionName: string, threads: SessionThread[]) {
  let content = `# ${sessionName}\n\n`
  for (let i = 0; i < threads.length; i++) {
    let thread = threads[i]
    content += `## ${i + 1}. ${thread.name}\n\n`
    for (const msg of thread.messages) {
      content += `**${msg.role}**: \n\n`
      content += '```\n' + getMessageText(msg).replaceAll(/```\w*/g, '') + '\n```\n\n'
    }
    content += '\n\n'
  }
  content += '--------------------\n\n'
  content += ``
  return content
}

export function formatChatAsTxt(sessionName: string, threads: SessionThread[]) {
  let content = `==================================== [[${sessionName}]] ====================================`
  for (let i = 0; i < threads.length; i++) {
    let thread = threads[i]
    content += `\n\n------------------------------ [${i + 1}. ${thread.name}] ------------------------------\n\n`
    for (const msg of thread.messages) {
      content += `▶ ${msg.role.toUpperCase()}: \n\n`
      content += getMessageText(msg) + '\n\n\n'
    }
    content += '\n\n\n\n'
  }
  content += `========================================================================\n\n`
  return content
}

export async function formatChatAsHtml(sessionName: string, threads: SessionThread[]) {
  let content = '<div class="prose-sm">\n'
  for (let i = 0; i < threads.length; i++) {
    let thread = threads[i]
    content += `<h2>${i + 1}. ${thread.name}</h2>\n`
    for (const msg of thread.messages) {
      content += '<div class="mb-4">\n'
      if (msg.role !== 'assistant') {
        content += `<p class="text-green-500 text-lg"><b>${msg.role.toUpperCase()}: </b></p>\n`
      } else {
        content += `<p class="text-blue-500 text-lg"><b>${msg.role.toUpperCase()}: </b></p>\n`
      }
      for (const p of msg.contentParts) {
        if (p.type === 'text') {
          try {
            content += ReactDOMServer.renderToStaticMarkup(<Markdown hiddenCodeCopyButton>{p.text}</Markdown>)
          } catch (error) {
            console.warn('HTML导出时Markdown渲染失败，降级为纯文本:', error)
            // 降级处理：如果Markdown渲染失败，就使用简单的HTML转义
            const escapedText = p.text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#x27;')
              .replace(/\n/g, '<br>')
            content += `<div class="whitespace-pre-wrap">${escapedText}</div>\n`
          }
        } else if (p.type === 'image') {
          if (p.storageKey) {
            let url = ''
            try {
              const b64 = await storage.getBlob(p.storageKey)
              if (b64) {
                let { type, data } = base64.parseImage(b64)
                if (type === '') {
                  type = 'image/png'
                  data = b64
                }
                url = `data:${type};base64,${data}`
              } else if ('url' in p) {
                url = p.url as string
              }
              content += `<img src="${url}" class="my-2" />\n`
            } catch (error) {
              console.warn('HTML导出时图片处理失败:', error)
              content += `<p class="text-red-500">[图片加载失败]</p>\n`
            }
          }
        }
      }
      content += '</div>\n'
    }
    content += '<hr />\n'
  }
  content += '</div>\n'
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${sessionName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
    <script>
        tailwind.config = {
        }
    </script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <link rel="shortcut icon" href="https://chatboxai.app/icon.png">
</head>
<body class='bg-slate-100'>
    <div class='mx-auto max-w-5xl shadow-md prose bg-white px-2 py-4'>
        <h1 class='flex flex-row justify-between items-center my-4 h-8'>
            <span>${sessionName}</span>
            <a href="https://chatboxai.app" target="_blank" >
                <img src='https://chatboxai.app/icon.png' class="w-12">
            </a>
        </h1>
        <hr />
        ${content}
        <hr />
        <a href="https://chatboxai.app" style="display: flex; align-items: center;" class="text-sky-500" target="_blank">
            <img src='https://chatboxai.app/icon.png' class="w-12 pr-2">
            <b style='font-size:30px'>Chatbox AI</b>
        </a>
        <p><a a href="https://chatboxai.app" target="_blank">https://chatboxai.app</a></p>
    </div>
</body>
</html>
`
}

export function formatChatAsJson(sessionName: string, threads: SessionThread[]) {
  return JSON.stringify(threads, null, 2)
}
