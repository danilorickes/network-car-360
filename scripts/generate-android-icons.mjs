import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Gera PNG válido em conformidade com especificação W3C PNG
function createPng(width, height, renderPixel) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8) // 8-bit depth
  ihdr.writeUInt8(6, 9) // RGBA
  ihdr.writeUInt8(0, 10)
  ihdr.writeUInt8(0, 11)
  ihdr.writeUInt8(0, 12)

  const ihdrChunk = createChunk('IHDR', ihdr)

  const rowLength = 1 + width * 4
  const rawData = Buffer.alloc(rowLength * height)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength
    rawData.writeUInt8(0, rowOffset)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = renderPixel(x, y)
      const pxOffset = rowOffset + 1 + x * 4
      rawData.writeUInt8(r, pxOffset)
      rawData.writeUInt8(g, pxOffset + 1)
      rawData.writeUInt8(b, pxOffset + 2)
      rawData.writeUInt8(a, pxOffset + 3)
    }
  }

  const compressed = deflateSync(rawData)
  const idatChunk = createChunk('IDAT', compressed)
  const iendChunk = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const crcTable = []
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1)
    } else {
      c = c >>> 1
    }
  }
  crcTable[n] = c
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type, data) {
  const len = data.length
  const header = Buffer.alloc(8)
  header.writeUInt32BE(len, 0)
  header.write(type, 4, 4, 'ascii')

  const toCrc = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crcVal = crc32(toCrc)

  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crcVal, 0)

  return Buffer.concat([header, data, crcBuf])
}

// Cores Oficiais Network Car:
// Background escuro: #0B0F14 (11, 15, 20)
// Âmbar / Amarelo destaque: #FFB300 (255, 179, 0)
// Secundário / Painel: #1A232E (26, 35, 46)
// Borda / Linha de apoio: #263340 (38, 51, 64)
function renderNetworkCarIcon(x, y, w, h, isRound) {
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const maxRadius = w / 2

  if (isRound) {
    if (dist > maxRadius) {
      return [0, 0, 0, 0]
    }
    const aaDist = maxRadius - dist
    let alpha = 255
    if (aaDist < 1.0) {
      alpha = Math.max(0, Math.min(255, Math.round(aaDist * 255)))
    }
    const [r, g, b] = getIconContentColor(x, y, w, h, dist, maxRadius)
    return [r, g, b, alpha]
  } else {
    // Squircle (ícone quadrado com cantos arredondados)
    const cornerRadius = w * 0.22
    const innerW = w / 2 - cornerRadius
    const innerH = h / 2 - cornerRadius
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    if (absX > innerW && absY > innerH) {
      const cdx = absX - innerW
      const cdy = absY - innerH
      const cdist = Math.sqrt(cdx * cdx + cdy * cdy)
      if (cdist > cornerRadius) {
        return [0, 0, 0, 0]
      }
      const aaDist = cornerRadius - cdist
      let alpha = 255
      if (aaDist < 1.0) {
        alpha = Math.max(0, Math.min(255, Math.round(aaDist * 255)))
      }
      const [r, g, b] = getIconContentColor(x, y, w, h, dist, maxRadius)
      return [r, g, b, alpha]
    }

    const [r, g, b] = getIconContentColor(x, y, w, h, dist, maxRadius)
    return [r, g, b, 255]
  }
}

function getIconContentColor(x, y, w, h, dist, maxRadius) {
  // Borda dourada sutil em volta
  if (dist > maxRadius - 2.5) {
    return [255, 179, 0]
  }

  const nx = (x - w / 2) / (w / 2)
  const ny = (y - h / 2) / (h / 2)

  // Pulso cardíaco / telemetria de atividade (símbolo de Activity do Network Car)
  let targetY = 0.05
  if (nx >= -0.7 && nx < -0.3) {
    targetY = 0.05
  } else if (nx >= -0.3 && nx < -0.15) {
    const t = (nx - -0.3) / 0.15
    targetY = 0.05 - 0.3 * t
  } else if (nx >= -0.15 && nx < 0.1) {
    const t = (nx - -0.15) / 0.25
    targetY = -0.25 + 0.7 * t
  } else if (nx >= 0.1 && nx < 0.3) {
    const t = (nx - 0.1) / 0.2
    targetY = 0.45 - 0.5 * t
  } else if (nx >= 0.3 && nx <= 0.7) {
    targetY = 0.05 - 0.1 * Math.sin((nx - 0.3) * 5)
  }

  const yDist = Math.abs(ny - -targetY)
  const lineWidth = 0.09
  if (Math.abs(nx) <= 0.7 && yDist < lineWidth) {
    const intensity = 1 - yDist / lineWidth
    return [255, Math.round(179 + 50 * intensity), Math.round(20 + 60 * intensity)]
  }

  // Anel sutil de telemetria 360
  if (dist > maxRadius * 0.76 && dist < maxRadius * 0.84) {
    return [38, 51, 64]
  }

  // Gradiente radial
  const grad = Math.min(1, dist / maxRadius)
  const r = Math.round(26 * (1 - grad) + 11 * grad)
  const g = Math.round(35 * (1 - grad) + 15 * grad)
  const b = Math.round(46 * (1 - grad) + 20 * grad)

  return [r, g, b]
}

// Foreground adaptativo (área segura central de 66%)
function renderForeground(x, y, w, h) {
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const safeRadius = (w * 0.66) / 2

  const nx = (x - w / 2) / (w / 2)
  const ny = (y - h / 2) / (h / 2)

  let targetY = 0.04
  if (nx >= -0.55 && nx < -0.25) {
    targetY = 0.04
  } else if (nx >= -0.25 && nx < -0.12) {
    const t = (nx - -0.25) / 0.13
    targetY = 0.04 - 0.28 * t
  } else if (nx >= -0.12 && nx < 0.1) {
    const t = (nx - -0.12) / 0.22
    targetY = -0.24 + 0.68 * t
  } else if (nx >= 0.1 && nx < 0.28) {
    const t = (nx - 0.1) / 0.18
    targetY = 0.44 - 0.48 * t
  } else if (nx >= 0.28 && nx <= 0.55) {
    targetY = 0.04 - 0.08 * Math.sin((nx - 0.28) * 6)
  }

  const yDist = Math.abs(ny - -targetY)
  const lineWidth = 0.075
  if (Math.abs(nx) <= 0.55 && yDist < lineWidth) {
    const intensity = 1 - yDist / lineWidth
    const alpha = Math.round(255 * Math.min(1, intensity * 1.5))
    return [255, Math.round(179 + 50 * intensity), 0, alpha]
  }

  const ringRadius = safeRadius * 0.75
  const ringDist = Math.abs(dist - ringRadius)
  if (ringDist < 6) {
    const alpha = Math.round(180 * (1 - ringDist / 6))
    return [255, 179, 0, alpha]
  }

  return [0, 0, 0, 0]
}

const DENSITIES = [
  { name: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { name: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { name: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { name: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { name: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
]

const baseResDir = join(process.cwd(), 'android', 'app', 'src', 'main', 'res')

for (const density of DENSITIES) {
  const dirPath = join(baseResDir, density.name)
  mkdirSync(dirPath, { recursive: true })

  // 1. ic_launcher.png
  const launcherPng = createPng(density.size, density.size, (x, y) =>
    renderNetworkCarIcon(x, y, density.size, density.size, false),
  )
  writeFileSync(join(dirPath, 'ic_launcher.png'), launcherPng)

  // 2. ic_launcher_round.png
  const roundPng = createPng(density.size, density.size, (x, y) =>
    renderNetworkCarIcon(x, y, density.size, density.size, true),
  )
  writeFileSync(join(dirPath, 'ic_launcher_round.png'), roundPng)

  // 3. ic_launcher_foreground.png
  const fgPng = createPng(density.fgSize, density.fgSize, (x, y) =>
    renderForeground(x, y, density.fgSize, density.fgSize),
  )
  writeFileSync(join(dirPath, 'ic_launcher_foreground.png'), fgPng)

  console.log(`Gerado: ${density.name} (${density.size}px + fg ${density.fgSize}px)`)
}

console.log('Todos os mipmaps gerados com sucesso!')
