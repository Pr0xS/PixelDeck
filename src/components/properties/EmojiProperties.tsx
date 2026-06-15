import { useEditorStore } from '@/store'
import type { EmojiLayer, Layer } from '@/types'
import { SliderField } from '@/components/properties/PropertyControls'
import { labelCls, panelSectionCls, pauseTemporal, resumeTemporal } from '@/components/properties/panelConstants'

// Common emoji categories for quick picking
const EMOJI_CATEGORIES = [
  { label: 'Smileys', emojis: ['😀','😂','🥹','😍','🤩','😎','🥳','🤔','😴','🤯','🥺','😭','😤','🤗','😇','🫡'] },
  { label: 'Gestures', emojis: ['👍','👎','👏','🙌','🤝','✌️','🤞','🫶','❤️','🔥','⭐','✨','💫','🎉','🎊','🏆'] },
  { label: 'Nature', emojis: ['🌟','🌈','☀️','🌙','⚡','❄️','🌊','🍀','🌸','🌺','🦋','🐝','🦄','🐉','🌴','🍁'] },
  { label: 'Objects', emojis: ['🚀','💡','🎯','🔑','💎','🎨','📱','💻','🎵','🎮','📸','🔮','⚙️','🛡️','⚔️','🏹'] },
  { label: 'Food', emojis: ['🍕','🍔','🍣','🍜','🍦','🍩','☕','🧃','🍺','🥂','🍓','🥑','🌮','🍿','🧁','🍰'] },
  { label: 'Symbols', emojis: ['✅','❌','⚠️','💯','🔴','🟢','🔵','🟡','⬆️','➡️','🔄','♾️','🆕','🆓','💬','📣'] },
]

export function EmojiProperties({ layer }: { layer: EmojiLayer }) {
  const updateLayer = useEditorStore((s) => s.updateLayer)
  const upd = (patch: Partial<EmojiLayer>) => updateLayer(layer.id, patch as Partial<Layer>)

  return (
    <div className="space-y-4">
      <div className={panelSectionCls}>
        <label className={labelCls}>Emoji</label>
        <input
          type="text"
          value={layer.emoji}
          onChange={(e) => upd({ emoji: e.target.value })}
          className="w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-2xl text-center text-[#e8e8f0] outline-none focus:border-[#7c6ef6] transition-colors"
          placeholder="Type or paste an emoji"
          maxLength={8}
        />
      </div>

      <div className={panelSectionCls}>
        <SliderField
          label="Size"
          value={layer.fontSize}
          min={10}
          max={500}
          unit="px"
          onChange={(v) => upd({ fontSize: v })}
          onInteractionStart={pauseTemporal}
          onInteractionEnd={resumeTemporal}
          className="!mb-0"
        />
      </div>

      {EMOJI_CATEGORIES.map((cat) => (
        <div key={cat.label} className={panelSectionCls}>
          <label className={labelCls}>{cat.label}</label>
          <div className="grid grid-cols-8 gap-1">
            {cat.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => upd({ emoji })}
                title={emoji}
                className={`flex items-center justify-center w-full aspect-square text-xl rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.1)] ${layer.emoji === emoji ? 'bg-[rgba(124,110,246,0.2)] ring-1 ring-[#7c6ef6]' : ''}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
