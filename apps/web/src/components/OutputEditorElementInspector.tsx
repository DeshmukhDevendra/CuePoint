import type { OutputLayoutElement } from '@cuepoint/shared'
import { Input } from '@/components/ui'

export function OutputEditorElementInspector({
  el,
  onPatch,
}: {
  el: OutputLayoutElement
  onPatch: (patch: Partial<OutputLayoutElement>) => void
}) {
  return (
    <div className="space-y-2 border-t border-border/60 pt-2 mt-2">
      {el.type === 'timer' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Timer index</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.timerIndex ?? 0}
              min={0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) onPatch({ timerIndex: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={el.showTitle !== false}
              onChange={(e) => onPatch({ showTitle: e.target.checked } as Partial<OutputLayoutElement>)}
            />
            <span>Show title</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={el.showSpeaker !== false}
              onChange={(e) => onPatch({ showSpeaker: e.target.checked } as Partial<OutputLayoutElement>)}
            />
            <span>Show speaker</span>
          </label>
        </>
      )}
      {el.type === 'message_strip' && (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Max lines</span>
          <Input
            type="number"
            className="h-8 text-xs max-w-[8rem]"
            value={el.maxLines ?? 3}
            min={1}
            max={10}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (!Number.isNaN(n)) onPatch({ maxLines: n } as Partial<OutputLayoutElement>)
            }}
          />
        </label>
      )}
      {el.type === 'label' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Text</span>
            <Input className="h-8 text-xs" value={el.text} onChange={(e) => onPatch({ text: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Font size (rem)</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.fontSizeRem ?? 1.25}
              step={0.05}
              min={0.5}
              max={24}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (!Number.isNaN(n)) onPatch({ fontSizeRem: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Color</span>
            <Input className="h-8 text-xs" value={el.color ?? ''} onChange={(e) => onPatch({ color: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
        </>
      )}
      {el.type === 'progress_bar' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Timer index</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.timerIndex ?? 0}
              min={0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) onPatch({ timerIndex: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Bar color</span>
            <Input className="h-8 text-xs" value={el.barColor ?? ''} onChange={(e) => onPatch({ barColor: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Track color</span>
            <Input className="h-8 text-xs" value={el.trackColor ?? ''} onChange={(e) => onPatch({ trackColor: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={el.horizontal !== false}
              onChange={(e) => onPatch({ horizontal: e.target.checked } as Partial<OutputLayoutElement>)}
            />
            <span>Horizontal</span>
          </label>
        </>
      )}
      {el.type === 'wall_clock' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Format</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={el.format}
              onChange={(e) => onPatch({ format: e.target.value as '12h' | '24h' } as Partial<OutputLayoutElement>)}
            >
              <option value="24h">24h</option>
              <option value="12h">12h</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={el.showSeconds !== false}
              onChange={(e) => onPatch({ showSeconds: e.target.checked } as Partial<OutputLayoutElement>)}
            />
            <span>Show seconds</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Label</span>
            <Input className="h-8 text-xs" value={el.label ?? ''} onChange={(e) => onPatch({ label: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
        </>
      )}
      {el.type === 'room_title' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Template</span>
            <Input className="h-8 text-xs" value={el.template ?? '{roomTitle}'} onChange={(e) => onPatch({ template: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Font size (rem)</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.fontSizeRem ?? 1.1}
              step={0.05}
              min={0.5}
              max={8}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (!Number.isNaN(n)) onPatch({ fontSizeRem: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
        </>
      )}
      {(el.type === 'timer_title_only' || el.type === 'timer_digits_only') && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Timer index</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.timerIndex ?? 0}
              min={0}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) onPatch({ timerIndex: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
          {el.type === 'timer_digits_only' && (
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">Size scale</span>
              <Input
                type="number"
                className="h-8 text-xs max-w-[8rem]"
                value={el.fontSizeScale ?? 1}
                step={0.05}
                min={0.35}
                max={4}
                onChange={(e) => {
                  const n = parseFloat(e.target.value)
                  if (!Number.isNaN(n)) onPatch({ fontSizeScale: n } as Partial<OutputLayoutElement>)
                }}
              />
            </label>
          )}
        </>
      )}
      {el.type === 'divider' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Orientation</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={el.orientation}
              onChange={(e) =>
                onPatch({ orientation: e.target.value as 'horizontal' | 'vertical' } as Partial<OutputLayoutElement>)
              }
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Thickness (px)</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.thicknessPx ?? 2}
              min={1}
              max={24}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) onPatch({ thicknessPx: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
        </>
      )}
      {el.type === 'image' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Image URL</span>
            <Input className="h-8 text-xs" value={el.src} onChange={(e) => onPatch({ src: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Fit</span>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={el.fit ?? 'cover'}
              onChange={(e) => onPatch({ fit: e.target.value as 'cover' | 'contain' } as Partial<OutputLayoutElement>)}
            >
              <option value="cover">cover</option>
              <option value="contain">contain</option>
            </select>
          </label>
        </>
      )}
      {el.type === 'messages_ticker' && (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Max messages</span>
          <Input
            type="number"
            className="h-8 text-xs max-w-[8rem]"
            value={el.maxItems ?? 6}
            min={1}
            max={20}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10)
              if (!Number.isNaN(n)) onPatch({ maxItems: n } as Partial<OutputLayoutElement>)
            }}
          />
        </label>
      )}
      {el.type === 'agenda' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Count</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.count ?? 6}
              min={1}
              max={20}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) onPatch({ count: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={el.showRemaining !== false}
              onChange={(e) => onPatch({ showRemaining: e.target.checked } as Partial<OutputLayoutElement>)}
            />
            <span>Show remaining</span>
          </label>
        </>
      )}
      {el.type === 'lower_third' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Line 1</span>
            <Input className="h-8 text-xs" value={el.line1} onChange={(e) => onPatch({ line1: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Line 2</span>
            <Input className="h-8 text-xs" value={el.line2 ?? ''} onChange={(e) => onPatch({ line2: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Accent</span>
            <Input className="h-8 text-xs" value={el.accentColor ?? ''} onChange={(e) => onPatch({ accentColor: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
        </>
      )}
      {el.type === 'qrcode' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Payload (URL or text)</span>
            <Input className="h-8 text-xs" value={el.data} onChange={(e) => onPatch({ data: e.target.value } as Partial<OutputLayoutElement>)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Margin</span>
            <Input
              type="number"
              className="h-8 text-xs max-w-[8rem]"
              value={el.margin ?? 1}
              min={0}
              max={8}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10)
                if (!Number.isNaN(n)) onPatch({ margin: n } as Partial<OutputLayoutElement>)
              }}
            />
          </label>
        </>
      )}
    </div>
  )
}
