import { Group, Rect, Arc, Circle, Text } from 'react-konva'
import type { PhoneStatusBarInfo } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PhoneStatusBarProps {
  spec: PhoneStatusBarInfo
  scale: number
  screenWidth: number        // logical px (before scale)
  screenCornerRadius: number // logical px — used to round solid bar top corners
  theme?: 'dark' | 'light'
  bg?: 'transparent' | 'solid'
  bgColor?: string
}

// ─── Icon sub-renderers ───────────────────────────────────────────────────────

/**
 * 4 cellular signal bars, bottom-aligned.
 * Anchor: (x, y) = bottom-left corner of the icon bounding box.
 * Bounding box: 16.5 × 13 logical px.
 */
function SignalBars({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  const barW = 3, gap = 1.5
  const heights = [4, 7, 10, 13]
  return (
    <>
      {heights.map((h, i) => (
        <Rect
          key={i}
          x={(x + i * (barW + gap)) * s}
          y={(y - h) * s}
          width={barW * s}
          height={h * s}
          fill={color}
          cornerRadius={0.8 * s}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  )
}

/**
 * WiFi arcs + dot.
 * Anchor: (cx, dotY) = center-x and y of the bottom dot.
 * Arcs open upward (rotation=210, angle=120 in Konva = sweeps through 270°=UP).
 */
function WifiIcon({ cx, dotY, s, color }: { cx: number; dotY: number; s: number; color: string }) {
  return (
    <>
      {/* 3 concentric arcs opening upward */}
      {([4, 7, 10] as const).map((r, i) => (
        <Arc
          key={i}
          x={cx * s}
          y={dotY * s}
          innerRadius={(r - 1.5) * s}
          outerRadius={r * s}
          angle={120}
          rotation={210}
          fill={color}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
      {/* Dot */}
      <Circle
        x={cx * s}
        y={dotY * s}
        radius={2 * s}
        fill={color}
        listening={false}
        perfectDrawEnabled={false}
      />
    </>
  )
}

/**
 * Battery icon: outline body + 75% fill + nub on the right.
 * Anchor: (x, y) = top-left of the body.
 * Bounding box: 27 × 12 logical px (body 24 + nub 3).
 */
function BatteryIcon({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  const bodyW = 24, bodyH = 12
  const fillW = Math.round((bodyW - 6) * 0.75)   // 75% of inner width
  return (
    <>
      {/* Outer body */}
      <Rect
        x={x * s}
        y={y * s}
        width={bodyW * s}
        height={bodyH * s}
        stroke={color}
        strokeWidth={1.5 * s}
        cornerRadius={2.5 * s}
        listening={false}
        perfectDrawEnabled={false}
      />
      {/* Fill */}
      <Rect
        x={(x + 3) * s}
        y={(y + 3) * s}
        width={fillW * s}
        height={(bodyH - 6) * s}
        fill={color}
        cornerRadius={1 * s}
        listening={false}
        perfectDrawEnabled={false}
      />
      {/* Nub */}
      <Rect
        x={(x + bodyW + 1) * s}
        y={(y + (bodyH - 6) / 2) * s}
        width={2.5 * s}
        height={6 * s}
        fill={color}
        cornerRadius={1 * s}
        listening={false}
        perfectDrawEnabled={false}
      />
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PhoneStatusBar({ spec, scale, screenWidth, screenCornerRadius, theme = 'dark', bg = 'transparent', bgColor = '#000000' }: PhoneStatusBarProps) {
  const s = scale
  const { platform, contentY, height } = spec
  const isDark = theme === 'dark'
  const color = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.82)'
  const isSolid = bg === 'solid'

  const isIos = platform === 'ios'

  // ── Right-side icon layout (right → left) ──────────────────────────────────
  // Battery body is 24px wide, nub adds 3.5px — total 27.5
  const RIGHT_MARGIN = 14
  const ICON_GAP = 6

  // Battery: top-left corner
  const battBodyW = 24
  const battH = 12
  const battX = screenWidth - RIGHT_MARGIN - battBodyW - 3.5   // account for nub
  const battY = contentY - battH / 2

  // WiFi: centered, dot at 5px below contentY
  const wifiCX = battX - ICON_GAP - 7     // 7 = half of 14px icon width
  const wifiDotY = contentY + 5

  // Signal bars: 16.5px wide, bottom at contentY + 6
  const sigBarW = 3, sigGap = 1.5
  const sigTotalW = 4 * sigBarW + 3 * sigGap  // 16.5
  const sigRightX = wifiCX - 7 - ICON_GAP     // 7 = half of wifi icon
  const sigX = sigRightX - sigTotalW           // left edge of bars
  const sigBaseY = contentY + 6               // bottom of tallest bar (13px)

  // ── Time text ─────────────────────────────────────────────────────────────
  const timeFontSize = 13
  // iOS: left of island gap (~26px); Android: near left edge
  const timeX = isIos ? 26 : 14
  const timeY = contentY - timeFontSize / 2
  const fontFamily = isIos
    ? 'SF Pro Text, -apple-system, Helvetica Neue, Helvetica, Arial, sans-serif'
    : 'Google Sans, Roboto, Arial, sans-serif'

  return (
    <Group listening={false}>
      {/* Background — solid fill only; transparent mode renders nothing.
          Top corners match the screen's corner radius so the bar stays inside the rounded frame.
          +1 logical px height overlaps the screenshot edge to prevent sub-pixel seams. */}
      {isSolid && (
        <Rect
          x={0}
          y={0}
          width={screenWidth * s}
          height={(height + 1) * s}
          fill={bgColor}
          cornerRadius={[screenCornerRadius * s, screenCornerRadius * s, 0, 0]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Time */}
      <Text
        x={timeX * s}
        y={timeY * s}
        text="9:41"
        fontSize={timeFontSize * s}
        fontFamily={fontFamily}
        fontStyle="bold"
        fill={color}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Signal bars */}
      <SignalBars x={sigX} y={sigBaseY} s={s} color={color} />

      {/* WiFi */}
      <WifiIcon cx={wifiCX} dotY={wifiDotY} s={s} color={color} />

      {/* Battery */}
      <BatteryIcon x={battX} y={battY} s={s} color={color} />
    </Group>
  )
}
