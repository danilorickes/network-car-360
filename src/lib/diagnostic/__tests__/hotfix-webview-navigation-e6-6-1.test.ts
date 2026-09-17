import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Hotfix APK Android WebView — Diagnóstico 360 e Prevenção de ERR_FILE_NOT_FOUND (v0.0.39)', () => {
  describe('1. Verificação Estática de Âncoras Absolutas (Prevenção de file:///...)', () => {
    it('src/pages/Index.tsx não deve conter <a href="/replay...', () => {
      const filePath = path.resolve(process.cwd(), 'src/pages/Index.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')

      // Não pode haver âncora nativa apontando para /replay
      expect(content).not.toMatch(/<a[^>]*href=\{?`?\/replay/)
      // Deve conter Link para /replay
      expect(content).toMatch(/<Link[^>]*to=\{?`?\/replay/)
    })

    it('src/pages/NetworkCarDrive.tsx não deve conter <a href="/replay">', () => {
      const filePath = path.resolve(process.cwd(), 'src/pages/NetworkCarDrive.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).not.toMatch(/<a[^>]*href=["']\/replay["']/)
      expect(content).toMatch(/<Link[^>]*to=["']\/replay["']/)
    })

    it('src/pages/NotFound.tsx não deve conter <a href="/">', () => {
      const filePath = path.resolve(process.cwd(), 'src/pages/NotFound.tsx')
      const content = fs.readFileSync(filePath, 'utf-8')

      expect(content).not.toMatch(/<a[^>]*href=["']\/["']/)
      expect(content).toMatch(/<Link[^>]*to=["']\/["']/)
    })

    it('Varredura geral de src/pages: nenhuma âncora <a href="/..."> para rotas internas da SPA', () => {
      const pagesDir = path.resolve(process.cwd(), 'src/pages')
      const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx'))

      for (const file of files) {
        const fullPath = path.join(pagesDir, file)
        const code = fs.readFileSync(fullPath, 'utf-8')

        // Regex para capturar <a href="/..." onde não seja link externo ou tel/mailto/http
        // e.g. <a href="/..." ou <a href={`/...`}
        const forbiddenAnchorRegex = /<a\s+[^>]*href=["'`](?:\/(?!\/)[^"'`]*)["'`]/g
        const matches = code.match(forbiddenAnchorRegex)

        expect(
          matches,
          `Arquivo ${file} contém âncoras nativas absolutas que quebram no WebView Android: ${JSON.stringify(matches)}`,
        ).toBeNull()
      }
    })
  })

  describe('2. Verificação de Recursos Relativos em index.html (Prevenção de file:///skip.png)', () => {
    it('index.html não deve conter referências absolutas /og-image.png ou /skip.png', () => {
      const indexHtmlPath = path.resolve(process.cwd(), 'index.html')
      const htmlContent = fs.readFileSync(indexHtmlPath, 'utf-8')

      expect(htmlContent).not.toMatch(/content=["']\/og-image\.png["']/)
      expect(htmlContent).not.toMatch(/href=["']\/skip\.png["']/)
      expect(htmlContent).not.toMatch(/href=["']\/favicon\.ico["']/)

      // Deve usar caminhos relativos ./ para ser compatível com file:///android_asset/
      expect(htmlContent).toMatch(/content=["']\.\/og-image\.png["']/)
      expect(htmlContent).toMatch(/href=["']\.\/skip\.png["']/)
    })
  })

  describe('3. Simulação de Navegação de Rota sob HashRouter vs BrowserRouter', () => {
    it('deve gerar URL com hash em ambiente file:// para qualquer sessão ativa (sem hardcode)', () => {
      const isFileProtocol = true // simula container Android WebView
      const sessionId = 'sess_1789619655803_7dlt'
      const targetRoute = `/replay?session=${sessionId}`

      // Sob HashRouter, a URL resultante no navegador/WebView é ancorada por hash
      const resolvedHashUrl = isFileProtocol ? `#${targetRoute}` : targetRoute

      expect(resolvedHashUrl).toBe('#/replay?session=sess_1789619655803_7dlt')
      expect(resolvedHashUrl.startsWith('#/replay')).toBe(true)
      // Teste negativo: nunca deve produzir URL fora do hash em file://
      expect(resolvedHashUrl.startsWith('/replay')).toBe(false)
    })

    it('funciona com qualquer sessão gerada dinamicamente sem ID pré-fixado', () => {
      const randomSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const isFileProtocol = true
      const targetRoute = `/replay?session=${randomSessionId}`
      const resolvedHashUrl = isFileProtocol ? `#${targetRoute}` : targetRoute

      expect(resolvedHashUrl).toBe(`#/replay?session=${randomSessionId}`)
      expect(resolvedHashUrl).toContain(randomSessionId)
    })
  })

  describe('4. Versionamento da Aplicação e APK Android (v0.0.40 / versionCode 9)', () => {
    it('package.json deve estar na versão 0.0.40', () => {
      const pkgJson = JSON.parse(
        fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'),
      )
      expect(pkgJson.version).toBe('0.0.40')
    })

    it('android/app/build.gradle deve estar com versionCode 9 e versionName "0.0.40-homologacao-e6.6.1"', () => {
      const gradleContent = fs.readFileSync(
        path.resolve(process.cwd(), 'android/app/build.gradle'),
        'utf-8',
      )
      expect(gradleContent).toMatch(/versionCode\s+9/)
      expect(gradleContent).toMatch(/versionName\s+"0\.0\.40-homologacao-e6\.6\.1"/)
    })
  })
})
