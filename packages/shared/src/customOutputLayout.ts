import { z } from 'zod'

const BoxSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(0).max(100),
  h: z.number().min(0).max(100),
})

/** How the public CUSTOM viewer treats room blackout (room-level flag). */
export const OutputBlackoutStyleSchema = z.enum(['fullscreen', 'dim', 'none'])
export type OutputBlackoutStyle = z.infer<typeof OutputBlackoutStyleSchema>

export const OutputLayoutElementSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('timer'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    timerIndex: z.number().int().min(0).max(50).default(0),
    showTitle: z.boolean().optional(),
    showSpeaker: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('message_strip'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    maxLines: z.number().int().min(1).max(10).optional(),
  }),
  z.object({
    type: z.literal('label'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    text: z.string().max(500),
    fontSizeRem: z.number().min(0.5).max(24).optional(),
    color: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal('progress_bar'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    timerIndex: z.number().int().min(0).max(50).default(0),
    barColor: z.string().max(64).optional(),
    trackColor: z.string().max(64).optional(),
    thicknessRem: z.number().min(0.15).max(6).optional(),
    horizontal: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('wall_clock'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    format: z.enum(['12h', '24h']).default('24h'),
    showSeconds: z.boolean().optional(),
    label: z.string().max(120).optional(),
    color: z.string().max(64).optional(),
    fontSizeRem: z.number().min(0.5).max(12).optional(),
  }),
  z.object({
    type: z.literal('room_title'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    template: z.string().max(200).optional(),
    color: z.string().max(64).optional(),
    fontSizeRem: z.number().min(0.5).max(8).optional(),
  }),
  z.object({
    type: z.literal('timer_title_only'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    timerIndex: z.number().int().min(0).max(50).default(0),
    color: z.string().max(64).optional(),
    fontSizeRem: z.number().min(0.5).max(8).optional(),
  }),
  z.object({
    type: z.literal('timer_digits_only'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    timerIndex: z.number().int().min(0).max(50).default(0),
    color: z.string().max(64).optional(),
    fontSizeScale: z.number().min(0.35).max(4).optional(),
  }),
  z.object({
    type: z.literal('divider'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
    color: z.string().max(64).optional(),
    thicknessPx: z.number().int().min(1).max(24).optional(),
  }),
  z.object({
    type: z.literal('image'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    src: z.string().url().max(2048),
    fit: z.enum(['cover', 'contain']).optional(),
    borderRadiusRem: z.number().min(0).max(4).optional(),
    opacity: z.number().min(0.05).max(1).optional(),
  }),
  z.object({
    type: z.literal('messages_ticker'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    maxItems: z.number().int().min(1).max(20).default(6),
    fontSizeRem: z.number().min(0.35).max(6).optional(),
    gapRem: z.number().min(0).max(3).optional(),
  }),
  z.object({
    type: z.literal('agenda'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    count: z.number().int().min(1).max(20).default(6),
    showRemaining: z.boolean().optional(),
    fontSizeRem: z.number().min(0.35).max(4).optional(),
    color: z.string().max(64).optional(),
    accentColor: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal('lower_third'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    line1: z.string().max(300),
    line2: z.string().max(300).optional(),
    accentColor: z.string().max(64).optional(),
    align: z.enum(['left', 'center']).optional(),
    fontSizeRem: z.number().min(0.35).max(4).optional(),
  }),
  z.object({
    type: z.literal('qrcode'),
    id: z.string().min(1).max(64),
    box: BoxSchema,
    data: z.string().min(1).max(800),
    darkColor: z.string().max(32).optional(),
    lightColor: z.string().max(32).optional(),
    margin: z.number().int().min(0).max(8).optional(),
  }),
])

export const OutputLayoutSchema = z.object({
  version: z.literal(1),
  aspect: z.enum(['16:9', '9:16', '4:3', '1:1']).default('16:9'),
  /** Solid color, rgba(), or short CSS gradient string. */
  background: z.string().max(512).default('#000000'),
  /** Optional CSS `font-family` stack for the whole stage. */
  fontFamily: z.string().max(200).optional(),
  /** Optional remote stylesheet (e.g. `@font-face` rules on your CDN). */
  fontCssUrl: z.union([z.string().url().max(2048), z.literal(''), z.null()]).optional(),
  backgroundImageUrl: z.union([z.string().url().max(2048), z.literal(''), z.null()]).optional(),
  backgroundImageFit: z.enum(['cover', 'contain']).optional(),
  blackoutStyle: OutputBlackoutStyleSchema.optional(),
  elements: z.array(OutputLayoutElementSchema).max(40),
})

export type OutputLayout = z.infer<typeof OutputLayoutSchema>
export type OutputLayoutElement = z.infer<typeof OutputLayoutElementSchema>

export const CUSTOM_OUTPUT_ELEMENT_TYPES = [
  'timer',
  'message_strip',
  'label',
  'progress_bar',
  'wall_clock',
  'room_title',
  'timer_title_only',
  'timer_digits_only',
  'divider',
  'image',
  'messages_ticker',
  'agenda',
  'lower_third',
  'qrcode',
] as const

export type CustomOutputElementType = (typeof CUSTOM_OUTPUT_ELEMENT_TYPES)[number]

export function createDefaultLayoutElement(type: CustomOutputElementType, id: string): OutputLayoutElement {
  const box = { x: 8, y: 10, w: 84, h: 12 }
  switch (type) {
    case 'timer':
      return { type, id, box: { x: 5, y: 8, w: 90, h: 50 }, timerIndex: 0, showTitle: true, showSpeaker: true }
    case 'message_strip':
      return { type, id, box: { x: 5, y: 72, w: 90, h: 18 }, maxLines: 3 }
    case 'label':
      return { type, id, box, text: 'Label', fontSizeRem: 1.25, color: 'rgba(255,255,255,0.85)' }
    case 'progress_bar':
      return { type, id, box: { x: 10, y: 60, w: 80, h: 4 }, timerIndex: 0, horizontal: true }
    case 'wall_clock':
      return { type, id, box: { x: 70, y: 4, w: 26, h: 10 }, format: '24h', showSeconds: true, label: 'Local' }
    case 'room_title':
      return { type, id, box: { x: 4, y: 4, w: 60, h: 8 }, template: '{roomTitle}', fontSizeRem: 1.1 }
    case 'timer_title_only':
      return { type, id, box, timerIndex: 0, fontSizeRem: 1.2 }
    case 'timer_digits_only':
      return { type, id, box: { x: 10, y: 28, w: 80, h: 28 }, timerIndex: 0, fontSizeScale: 1 }
    case 'divider':
      return { type, id, box: { x: 5, y: 48, w: 90, h: 0.8 }, orientation: 'horizontal', thicknessPx: 2 }
    case 'image':
      return {
        type,
        id,
        box: { x: 72, y: 18, w: 22, h: 22 },
        src: 'https://picsum.photos/seed/cuepoint/400/400',
        fit: 'cover',
      }
    case 'messages_ticker':
      return { type, id, box: { x: 5, y: 62, w: 90, h: 22 }, maxItems: 6, fontSizeRem: 0.95 }
    case 'agenda':
      return { type, id, box: { x: 4, y: 16, w: 36, h: 55 }, count: 6, showRemaining: true, fontSizeRem: 0.85 }
    case 'lower_third':
      return {
        type,
        id,
        box: { x: 4, y: 78, w: 70, h: 14 },
        line1: '{timerTitle}',
        line2: '{speaker}',
        align: 'left',
        accentColor: '#38bdf8',
      }
    case 'qrcode':
      return { type, id, box: { x: 82, y: 78, w: 14, h: 18 }, data: 'https://cuepoint.app', margin: 1 }
    default: {
      const _x: never = type
      return _x
    }
  }
}

export function defaultCustomOutputLayout(): OutputLayout {
  return {
    version: 1,
    aspect: '16:9',
    background: '#000000',
    blackoutStyle: 'fullscreen',
    elements: [
      {
        type: 'timer',
        id: 't1',
        box: { x: 5, y: 8, w: 90, h: 62 },
        timerIndex: 0,
        showTitle: true,
        showSpeaker: true,
      },
      {
        type: 'message_strip',
        id: 'm1',
        box: { x: 5, y: 74, w: 90, h: 18 },
      },
    ],
  }
}

export function parseOutputLayoutOrDefault(raw: unknown): OutputLayout {
  const r = OutputLayoutSchema.safeParse(raw)
  return r.success ? r.data : defaultCustomOutputLayout()
}
