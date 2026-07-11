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

export interface BrandColor {
  id: string      // nanoid(10) key
  name: string    // display name e.g. 'Primary'
  value: string   // hex color e.g. '#FF5A5F'
}

// ─── Custom Fonts ─────────────────────────────────────────────────────────────

/**
 * A user-uploaded font registered in the project.
 * `family` is the opaque CSS font-family name used in fontFamily fields.
 * `label` is the human-readable display name shown in the picker.
 * `filename` is the key in fontStore.
 */
export interface CustomFontRef {
  /** Opaque CSS family name — unique, collision-safe (e.g. "pf_MyBrand_a3f2") */
  family: string
  /** Human-readable display name (e.g. "MyBrand") */
  label: string
  /** Key in fontStore (e.g. "MyBrand.ttf") */
  filename: string
  format: 'ttf' | 'otf' | 'woff2' | 'woff'
}

// ─── Phone Models ────────────────────────────────────────────────────────────

export type PhoneModel = 'iphone-16-pro' | 'iphone-16-pro-plain' | 'pixel-9' | 'pixel-9-plain';

// ─── Canvas Formats ──────────────────────────────────────────────────────────

export type BuiltInFormatId = 'base' | 'iphone-69' | 'android-phone' | 'ipad-13' | 'android-tablet'
export type CustomFormatId = `custom:${string}`
export type CanvasFormatId = BuiltInFormatId | CustomFormatId

export interface CustomCanvasFormat {
  id: CustomFormatId
  label: string
  width: number
  height: number
}

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
  marks?: TextMark[];
  /** @deprecated Legacy. Kept for reading old project files. */
  spans?: TextSpan[];
  // PhoneLayer
  screenshotPath?: string;
  screenshotDataUrl?: string;
  // ImageLayer
  src?: string;
}

/**
 * Controls how a layer participates in localization / bulk AI translation.
 *  - 'auto'   : eligible for bulk AI translate (default; undefined === 'auto')
 *  - 'manual' : human-entered overrides only; bulk translate SKIPS it
 *  - 'skip'   : not localized at all; excluded from manifest + progress denominator
 */
export type LocalizationMode = 'auto' | 'manual' | 'skip';

/** A single entry in a batch locale override commit. */
export interface LocaleOverrideBatchEntry {
  slideGroupId: string;
  layerId: string;
  locale: string;
  patch: LocaleLayerPatch;
}

/**
 * Per-format visual overrides. These are shallow-merged on top of the shared
 * base layer when previewing/exporting a specific canvas format.
 */
export type FormatLayerPatch = Partial<Omit<Layer, 'id' | 'type' | 'formatOverrides' | 'formatVisibility'>>;

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
  /** Per-format visual/layout overrides. Base layer remains the shared source. */
  formatOverrides?: Partial<Record<CanvasFormatId, FormatLayerPatch>>;
  /** Optional per-format visibility. Undefined = follows `visible`. */
  formatVisibility?: Partial<Record<CanvasFormatId, boolean>>;
  /**
   * If set, this layer belongs exclusively to one format and is invisible in all others.
   * Set automatically when a layer is added while viewing a non-base format.
   * Cleared when the user explicitly "Makes shared".
   */
  ownerFormat?: CanvasFormatId;
  /**
   * Localization participation mode. Undefined === 'auto'.
   * Co-located with localeOverrides because it is layer-scoped, undoable,
   * and travels with copy/paste + manifest.
   */
  localizationMode?: LocalizationMode;
}

export type LayerType = 'background' | 'phone' | 'text' | 'image' | 'shape' | 'emoji' | 'brand' | 'group';

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
  /** Inline data URL for image background mode */
  imageDataUrl?: string;
  /** How to fit the image within the canvas */
  imageFit?: 'cover' | 'contain' | 'fill';
  /** Blur radius in px applied to the background image */
  imageBlur?: number;
  /** Hex color of the overlay tint placed above the image */
  imageOverlayColor?: string;
  /** Opacity of the overlay tint (0–1) */
  imageOverlayOpacity?: number;
  /** Noise texture opacity (0–1). 0 = off. */
  noise?: number;
}

// ─── Layer Variants ───────────────────────────────────────────────────────────

export interface PhoneBorder {
  color: string;    // hex
  width: number;    // px at 1x scale
  opacity: number;  // 0–1
}

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
  /** Optional border drawn inside the screen area (above the screenshot, below the frame). */
  border?: PhoneBorder;
}

/**
 * A styled text segment within a TextLayer.
 * Fields are optional overrides of the parent layer's values.
 * @deprecated Use TextMark instead. Kept only for reading legacy project files.
 */
export interface TextSpan {
  text: string;
  /** Override fill for this segment. Undefined = inherit layer.fill */
  fill?: FillValue;
  /** Override font weight. Undefined = inherit layer.fontWeight */
  fontWeight?: number;
  /** Override italic. Undefined = inherit layer.italic */
  italic?: boolean;
  /** Override underline. Undefined = inherit layer.underline */
  underline?: boolean;
  /** Override strikethrough. Undefined = inherit layer.strikethrough */
  strikethrough?: boolean;
}

/**
 * A styled range over layer.text.
 * start is inclusive, end is exclusive (like String.slice).
 * All style fields are optional overrides of the parent layer's values.
 */
export interface TextMark {
  start: number;
  end: number;
  /** Override fill for this range. Undefined = inherit layer.fill */
  fill?: FillValue;
  /** Override font weight. Undefined = inherit layer.fontWeight */
  fontWeight?: number;
  /** Override italic. Undefined = inherit layer.italic */
  italic?: boolean;
  /** Override underline. Undefined = inherit layer.underline */
  underline?: boolean;
  /** Override strikethrough. Undefined = inherit layer.strikethrough */
  strikethrough?: boolean;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fill: FillValue;
  letterSpacing: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  width?: number;   // wrapping width; undefined = auto
  /**
   * Explicit box height. undefined = auto (box grows with content).
   * When set, the text box has a fixed height; content is clipped if taller.
   */
  height?: number;
  /** Vertical anchoring of the text inside the box. Only meaningful when height is set. Defaults to 'top'. */
  verticalAlign?: 'top' | 'middle' | 'bottom';
  /**
   * Rich text marks: styled ranges over `text` (preferred system).
   * start/end are char offsets into `text` (end exclusive, like String.slice).
   * When defined, enables rich-text rendering; `text` remains the single source of truth.
   */
  marks?: TextMark[];
  /**
   * @deprecated Legacy rich text spans. Kept for reading old project files only.
   * Automatically migrated to `marks` on import. Do not write.
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

export type ShapeType = 'rect' | 'ellipse' | 'arrow' | 'triangle' | 'star' | 'pentagon' | 'hexagon' | 'diamond' | 'cross' | 'check';

export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  shapeType: ShapeType;
  width: number;
  height: number;
  fill: FillValue;
  cornerRadius: number;
  stroke?: string;
  strokeWidth?: number;
  /** Number of points for star shape (3–12). Default 5. */
  starPoints?: number;
  /** Inner radius ratio for star (0.1–0.9). Default 0.4. */
  starInnerRatio?: number;
  /** Arrow direction for arrow shape. Default 'right'. */
  arrowDirection?: 'up' | 'down' | 'left' | 'right';
}

export interface EmojiLayer extends BaseLayer {
  type: 'emoji';
  emoji: string;   // the emoji character(s), e.g. '🚀'
  fontSize: number; // size in px
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
  /** Uniform scale applied to all children. Undefined = 1 (backwards compat with old project files). */
  scale?: number
}

export type Layer = BackgroundLayer | PhoneLayer | TextLayer | ImageLayer | ShapeLayer | EmojiLayer | BrandLayer | GroupLayer;

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

export interface PanoSettings {
  gapPx: number;
  compensate: boolean;
}

export interface ProjectSettings {
  defaultSlideWidth: number;
  defaultSlideHeight: number;
  /** The base locale — all layer values are authored in this locale. Defaults to 'en'. */
  defaultLocale: string;
  /** Full list of defined locales including defaultLocale (e.g. ['en', 'es', 'fr']). */
  locales?: string[];
  brandName: string;
  brandLogoDataUrl?: string;
  brandColors?: BrandColor[];
  outputPath?: string;  // last used output dir (File System Access API handle)
  /** Non-exported authoring canvas sentinel. Defaults to base. */
  baseCanvasFormat?: CanvasFormatId;
  /** Exportable platform formats the user has opted into. Default = iPhone + Android. */
  activeFormats?: CanvasFormatId[];
  customFormats?: CustomCanvasFormat[];
  pano?: PanoSettings;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  slideGroups: SlideGroup[];
  /** User-uploaded custom fonts registered for this project. */
  customFonts?: CustomFontRef[];
  /** User-saved gradient presets for this project. */
  savedGradients?: FillValue[];
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
