import fs from 'fs'
import path from 'path'


function galleryExamples() {
  const examplesDir = path.resolve(__dirname, '../examples/gallery')
  const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.md'))

  return files.map(file => {
    const filePath = path.join(examplesDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const match = content.match(/^\s*---\s*[\r\n]+[\s\S]*?title:\s*["'](.+?)["']/m)
    const title = match ? match[1] : file.replace('.md', '')

    return {
      text: title,
      link: `/examples/gallery/${file.replace('.md', '')}`
    }
  })
}

export { galleryExamples }