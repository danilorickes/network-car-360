import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Função para gerar um buffer PNG RGB não comprimido/deflated
function createPng(
  width: number,
  height: number,
  renderPixel: (x: number, y: number) => [number, number, number, number],
): Buffer {
  // Assinatura PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.writeUInt8(8, 8) // bit depth: 8
  ihdr.writeUInt8(6, 9) // color type: 6 (RGBA)
  ihdr.writeUInt8(0, 10) // compression method: 0
  ihdr.writeUInt8(0, 11) // filter method: 0
  ihdr.writeUInt8(0, 12) // interlace: 0

  const ihdrChunk = createChunk('IHDR', ihdr)

  // Scanlines (cada linha começa com filter byte 0)
  const rowLength = 1 + width * 4
  const rawData = Buffer.alloc(rowLength * height)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength
    rawData.writeUInt8(0, rowOffset) // Filter type None
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

// CRC32 table
const crcTable: number[] = []
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

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createChunk(type: string, data: Buffer): Buffer {
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

// Renderizador para o ícone Network Car (quadrado com cantos arredondados)
// Cores: Fundo #0B0F14 (11, 15, 20), Borda/Detalhe #FFB300 (255, 179, 0), Branco #FFFFFF
function renderNetworkCarIcon(
  x: number,
  y: number,
  w: number,
  h: number,
  isRound: boolean,
): [number, number, number, number] {
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const maxRadius = w / 2

  if (isRound) {
    if (dist > maxRadius) {
      return [0, 0, 0, 0] // Transparente fora do círculo
    }
    // Anti-aliasing suave na borda circular
    const aaDist = maxRadius - dist
    let alpha = 255
    if (aaDist < 1.0) {
      alpha = Math.max(0, Math.min(255, Math.round(aaDist * 255)))
    }
    const [r, g, b] = getIconContentColor(x, y, w, h, dist, maxRadius)
    return [r, g, b, alpha]
  } else {
    // Quadrado com cantos arredondados (squircle / squarish)
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

function getIconContentColor(
  x: number,
  y: number,
  w: number,
  h: number,
  dist: number,
  maxRadius: number,
): [number, number, number] {
  // Fundo #0B0F14 (11, 15, 20) com borda dourada âmbar #FFB300
  // Anel externo sutil
  if (dist > maxRadius - 2.5) {
    return [255, 179, 0] // #FFB300
  }

  // Desenho central:
  // Um badge central com onda de pulso/ECG/telemetria (Activity) estilizada em âmbar (#FFB300)
  // Normalizando coordenadas locais de -1.0 a +1.0
  const nx = (x - w / 2) / (w / 2) // -1.0 a 1.0
  const ny = (y - h / 2) / (h / 2) // -1.0 a 1.0

  // Linha de telemetria / pulso central (y próximo de 0):
  // nx de -0.65 a +0.65
  // Pulso: linha plana -> pico negativo -> pico positivo -> retorno
  let targetY = 0.05
  if (nx >= -0.7 && nx < -0.3) {
    targetY = 0.05 // linha reta
  } else if (nx >= -0.3 && nx < -0.15) {
    // descida rápida para -0.25 (pico baixo)
    const t = (nx - -0.3) / 0.15
    targetY = 0.05 - 0.3 * t
  } else if (nx >= -0.15 && nx < 0.1) {
    // subida acentuada para pico alto (+0.4)
    const t = (nx - -0.15) / 0.25
    targetY = -0.25 + 0.7 * t
  } else if (nx >= 0.1 && nx < 0.3) {
    // descida de volta
    const t = (nx - 0.1) / 0.2
    targetY = 0.45 - 0.5 * t
  } else if (nx >= 0.3 && nx <= 0.7) {
    targetY = 0.05 - 0.1 * Math.sin((nx - 0.3) * 5)
  }

  const yDist = Math.abs(ny - -targetY) // Inverter Y do canvas (tela ny cresce para baixo)
  const lineWidth = 0.09
  if (Math.abs(nx) <= 0.7 && yDist < lineWidth) {
    // Brilho dourado intenso
    const intensity = 1 - yDist / lineWidth
    return [Math.round(255), Math.round(179 + 60 * intensity), Math.round(20 + 80 * intensity)]
  }

  // Letra 'N' ou símbolo '360' no topo?
  // Círculo concêntrico de telemetria estilizado (#1A232E e anéis)
  if (dist > maxRadius * 0.78 && dist < maxRadius * 0.85) {
    return [38, 51, 64] // #263340
  }

  // Gradiente sutil de fundo: do centro (#1A232E: 26, 35, 46) para as bordas (#0B0F14: 11, 15, 20)
  const grad = Math.min(1, dist / maxRadius)
  const r = Math.round(26 * (1 - grad) + 11 * grad)
  const g = Math.round(35 * (1 - grad) + 15 * grad)
  const b = Math.round(46 * (1 - grad) + 20 * grad)

  return [r, g, b]
}

// Foreground adaptativo (para ic_launcher_foreground.png):
// Deve conter o símbolo central com fundo transparente, 432x432 (safe zone central 288x288)
function renderForeground(
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number, number, number] {
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const safeRadius = (w * 0.66) / 2 // raio seguro da área visível do adaptive icon

  const nx = (x - w / 2) / (w / 2)
  const ny = (y - h / 2) / (h / 2)

  // Pulso de telemetria central (activity)
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

  // Anel de diagnóstico 360 sutil
  const ringRadius = safeRadius * 0.75
  const ringDist = Math.abs(dist - ringRadius)
  if (ringDist < 6) {
    const alpha = Math.round(180 * (1 - ringDist / 6))
    return [255, 179, 0, alpha]
  }

  return [0, 0, 0, 0]
}

const DENSITIES = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
]

const baseResDir = join(process.cwd(), 'android', 'app', 'src', 'main', 'res')

console.log('Gerando ícones mipmap em:', baseResDir)

for (const density of DENSITIES) {
  const dirPath = join(baseResDir, density.name)
  mkdirSync(dirPath, { recursive: true })

  // 1. ic_launcher.png (quadrado / cantos arredondados)
  const launcherPng = createPng(density.size, density.size, (x, y) =>
    renderNetworkCarIcon(x, y, density.size, density.size, false),
  )
  writeFileSync(join(dirPath, 'ic_launcher.png'), launcherPng)

  // 2. ic_launcher_round.png (circular)
  const roundPng = createPng(density.size, density.size, (x, y) =>
    renderNetworkCarIcon(x, y, density.size, density.size, true),
  )
  writeFileSync(join(dirPath, 'ic_launcher_round.png'), roundPng)

  console.log(`Gerado: ${density.name} (${density.size}x${density.size}px)`)
}

// Gerar também foreground para adaptive icons (xxxhdpi = 432x432, xxhdpi = 324x324, xhdpi = 216x216, hdpi = 162x162, mdpi = 108x108)
const ADAPTIVE_DENSITIES = [
  { name: 'mipmap-mdpi', size: 108 },
  { name: 'mipmap-hdpi', size: 162 },
  { name: 'mipmap-xhdpi', size: 216 },
  { name: 'mipmap-xxhdpi', size: 324 },
  { name: 'mipmap-xxxhdpi', size: 432 },
]

for (const density of ADAPTIVE_DENSITIES) {
  const dirPath = join(baseResDir, density.name)
  const fgPng = createPng(density.size, density.size, (x, y) =>
    renderForeground(x, y, density.size, density.size),
  )
  writeFileSync(join(dirPath, 'ic_launcher_foreground.png'), fgPng)
}

console.log('Todos os mipmaps gerados com sucesso!')
