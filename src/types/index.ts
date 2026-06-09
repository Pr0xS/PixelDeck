// ─── Brand & Colors ──────────────────────────────────────────────────────────

export interface GradientStop {
  offset: number;  // 0–1
  color: string;
}

export interface LinearGradient {
  type: 'linear';
  angle: number;   // degrees
  stops: GradientStop[];
}

export interface RadialGradient {
  type: 'radial';
  cx: number; cy: number;  // center as fraction 0–1
  radius: number;           // as fraction of shorter dimension
  stops: GradientStop[];
}

export type FillValue = string | LinearGradient | RadialGradient;

export interface ShadowConfig {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
}

// ─── Phone Models ────────────────────────────────────────────────────────────

export type PhoneModel = 'iphone-16-pro' | 'iphone-16-pro-plain' | 'pixel-9' | 'pixel-9-plain';

/** Screen area within the mockup frame (all in "phone canvas" pixels) */
export interface PhoneScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

/** Status bar metadata — all values in screen-relative logical px (before layer scale) */
export interface PhoneStatusBarInfo {
  /** Height of the status bar zone from screen top */
  height: number;
  /** Platform determines icon style and font */
  platform: 'ios' | 'android';
  /**
   * Vertical center of the status bar content row.
   * For iOS: center of the Dynamic Island.
   * For Android: center of the punch-hole camera.
   */
  contentY: number;
}

export interface PhoneModelSpec {
  id: PhoneModel;
  label: string;
  frameWidth: number;    // SVG viewBox width
  frameHeight: number;   // SVG viewBox height
  screen: PhoneScreenRect;
  statusBar: PhoneStatusBarInfo;
}

// ─── Localization ─────────────────────────────────────────────────────────────

/**
 * Per-locale override patch for a layer's localizable properties.
 * Shallow-merged on top of the base layer at render / export time via applyLocale().
 * Only fields relevant to the layer type are used; others are ignored.
 */
export interface LocaleLayerPatch {
  // TextLayer
  text?: string;
  spans?: TextSpan[];
  // PhoneLayer
  screenshotPath?: string;
  screenshotDataUrl?: string;
  // ImageLayer
  src?: string;
}

// ─── Layer Base ───────────────────────────────────────────────────────────────

export interface BaseLayer {
  id: string;
  name: string;
  type: LayerType;
  x: number;
  y: number;
  rotation: number;   // degrees
  opacity: number;    // 0–1
  visible: boolean;
  locked: boolean;
  blur?: number;      // blur radius in px
  shadow?: ShadowConfig;
  /**
   * Per-locale property overrides. Key = locale code (e.g. 'es').
   * Merged at render / export time by applyLocale(). Never affects undo history shape.
   */
  localeOverrides?: Record<string, LocaleLayerPatch>;
}

export type LayerType = 'background' | 'phone' | 'text' | 'image' | 'shape' | 'chips' | 'brand' | 'group';

// ─── Background ──────────────────────────────────────────────────────────────

export interface BackgroundAccent {
  color: string;
  cx: number; cy: number;  // % of canvas size
  rx: number; ry: number;  // absolute px radii
}

export interface BackgroundLayer extends BaseLayer {
  type: 'background';
  fill: FillValue;
  accents: BackgroundAccent[];
}

// ─── Layer Variants ───────────────────────────────────────────────────────────

export interface PhoneLayer extends BaseLayer {
  type: 'phone';
  model: PhoneModel;
  scale: number;
  /** Filename key in AssetStore (preferred over screenshotDataUrl) */
  screenshotPath?: string;
  /** Fallback: inline base64 data URL (backwards compat, used when screenshotPath not in store) */
  screenshotDataUrl?: string;
  screenshotFit: 'cover' | 'contain' | 'fill';
  screenshotOffsetX: number;   // pan within screen (0 = top-aligned)
  screenshotOffsetY: number;
  /** Whether to render the simulated OS status bar. Defaults to true. */
  showStatusBar?: boolean;
  /** Status bar icon/text colour scheme. 'dark' = white icons, 'light' = dark icons. Defaults to 'dark'. */
  statusBarTheme?: 'dark' | 'light';
  /** Status bar background style. 'transparent' = icons float over screenshot, 'solid' = opaque fill that shrinks the screenshot area. Defaults to 'transparent'. */
  statusBarBg?: 'transparent' | 'solid';
  /** Solid background colour (hex). Only used when statusBarBg === 'solid'. Defaults to '#000000'. */
  statusBarColor?: string;
}

/**
 * A styled text segment within a TextLayer.
 * Fields are optional overrides of the parent layer's values.
 */
export interface TextSpan {
  text: string;
  /** Override fill for this segment. Undefined = inherit layer.fill */
  fill?: FillValue;
  /** Override font weight. Undefined = inherit layer.fontWeight */
  fontWeight?: number;
  /** Override italic. Undefined = inherit layer.italic */
  italic?: boolean;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic?: boolean;
  fill: FillValue;
  letterSpacing: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  width?: number;   // wrapping width; undefined = auto
  /**
   * Rich text mode: array of styled spans.
   * When defined (non-empty), overrides `text` for rendering.
   * Use \n within span.text for explicit line breaks.
   */
  spans?: TextSpan[];
}

export interface ImageLayer extends BaseLayer {
  type: 'image';
  src: string;   // data URI
  width: number;
  height: number;
  cornerRadius: number;
}

export type ShapeType = 'rect' | 'ellipse' | 'line';

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: ShapeType;
  width: number;
  height: number;
  fill: FillValue;
  cornerRadius: number;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * Visual style for an individual chip.
 * - filled  → gradient background (vibrant)
 * - outlined → border only, transparent bg
 * - soft    → lightly tinted with primary color
 * - dark    → dark semi-transparent (glass)
 * - plain   → neutral background
 */
export type ChipVariant = 'filled' | 'outlined' | 'soft' | 'dark' | 'plain'

export interface ChipItem {
  label: string;
  /** @deprecated use variant instead */
  primary: boolean;
  /** Visual style — overrides the legacy `primary` flag when set */
  variant?: ChipVariant;
}

export interface ChipsLayer extends BaseLayer {
  type: 'chips';
  items: ChipItem[];
  primaryGradientFrom: string;
  primaryGradientTo: string;
  primaryTextColor: string;
  defaultBg: string;
  defaultTextColor: string;
  chipFontSize: number;
  gap: number;
  direction: 'row' | 'column';
}

export interface BrandLayer extends BaseLayer {
  type: 'brand';
  appName: string;
  logoDataUrl?: string;
  logoSize: number;
  nameColor: string;
  nameFontSize: number;
  nameFontFamily: string;
  nameFontWeight: number;
  direction: 'row' | 'column';
  gap: number;
}

export interface GroupLayer extends BaseLayer {
  type: 'group'
  children: Layer[]
}

export type Layer = BackgroundLayer | PhoneLayer | TextLayer | ImageLayer | ShapeLayer | ChipsLayer | BrandLayer | GroupLayer;

// ─── CanvasBackground (legacy — kept for backwards-compat with old project files) ──

export interface CanvasBackground {
  fill: FillValue;
  accents?: Array<{
    color: string;
    cx: number; cy: number;   // % of canvas
    rx: number; ry: number;   // px
  }>;
}

// ─── Slide Group ──────────────────────────────────────────────────────────────

/**
 * A SlideGroup renders on a single wide canvas (width * numSlides × height)
 * and is exported as `numSlides` individual PNGs, each `width` pixels wide.
 * This enables the "pano" effect where a phone crosses the seam between slides.
 */
export interface SlideGroup {
  id: string;
  name: string;
  /** Number of adjacent output slides sharing this canvas. 1 = single, 2 = pano */
  numSlides: number;
  slideWidth: number;
  slideHeight: number;
  /** @deprecated Background is now stored as a BackgroundLayer at layers[0]. Kept for migration only. */
  background?: CanvasBackground;
  layers: Layer[];
  /** Output filenames per slide (length === numSlides) */
  slideNames: string[];
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface ProjectSettings {
  defaultSlideWidth: number;
  defaultSlideHeight: number;
  /** The base locale — all layer values are authored in this locale. Defaults to 'en'. */
  defaultLocale: string;
  /** Full list of defined locales including defaultLocale (e.g. ['en', 'es', 'fr']). */
  locales?: string[];
  brandName: string;
  brandLogoDataUrl?: string;
  outputPath?: string;  // last used output dir (File System Access API handle)
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  slideGroups: SlideGroup[];
}

// ─── Selection ────────────────────────────────────────────────────────────────

export interface Selection {
  slideGroupId: string;
  /** Top-level layer id — or child id when editingGroupId is set (group edit mode) */
  layerId: string | null;
}

// ─── Template ────────────────────────────────────────────────────────────────

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Discriminator — always 'template' to distinguish from Project JSON */
  kind: 'template';
  /** Format version. Bump only on breaking schema changes. */
  schemaVersion: 1;
  thumbnail?: string;           // data URL or relative path e.g. /templates/thumbs/slug.png
  slideGroups: Omit<SlideGroup, 'id'>[];
  settings?: Partial<ProjectSettings>;
  category?: string;
  author?: string;
  createdAt?: string;
}
