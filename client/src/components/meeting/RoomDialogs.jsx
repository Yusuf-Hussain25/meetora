import { KeyboardIcon, SettingsIcon } from 'lucide-react'
import Modal from '../ui/Modal'

const DeviceSelect = ({ id, label, list, value, onChange, empty }) => (
  <div className="field">
    <label htmlFor={id}>{label}</label>
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={!list.length}>
      {!list.length && <option>{empty}</option>}
      {!value && list.length > 0 && <option value="">System default</option>}
      {list.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
    </select>
  </div>
);

const Toggle = ({ id, label, hint, checked, onChange }) => (
  <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-3.5">
    <span>
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-[12.5px] text-fg-3">{hint}</span>}
    </span>
    <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="relative h-6 w-11 shrink-0 rounded-full bg-surface-3 transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
  </label>
);

export const SettingsModal = ({ open, onClose, media, mirror, onMirror }) => {
  const canPickSpeaker = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  return (
    <Modal open={open} onClose={onClose} title="Audio & video" subtitle="Changes apply instantly, even mid-call." icon={<SettingsIcon size={20} />} size="sm">
      <div className="space-y-4 p-5 sm:p-6">
        <DeviceSelect id="cam" label="Camera" list={media.devices.videoinput} value={media.selected.videoinput} onChange={(v) => media.switchDevice('videoinput', v)} empty="No camera found" />
        <DeviceSelect id="mic" label="Microphone" list={media.devices.audioinput} value={media.selected.audioinput} onChange={(v) => media.switchDevice('audioinput', v)} empty="No microphone found" />
        {canPickSpeaker && (
          <DeviceSelect id="spk" label="Speaker" list={media.devices.audiooutput} value={media.selected.audiooutput} onChange={(v) => media.switchDevice('audiooutput', v)} empty="System default" />
        )}
        <Toggle id="ns" label="Noise suppression" hint="Filters keyboard clicks, fans and background chatter" checked={media.noiseSuppression} onChange={media.setNoiseSuppression} />
        <Toggle id="mirror" label="Mirror my video" hint="Only changes how you see yourself" checked={mirror} onChange={onMirror} />
      </div>
    </Modal>
  );
};

const SHORTCUTS = [
  ['M', 'Mute or unmute'],
  ['V', 'Camera on or off'],
  ['H', 'Raise or lower hand'],
  ['L', 'Live captions'],
  ['C', 'Open chat'],
  ['P', 'Show people'],
  ['A', 'AI: catch me up'],
  ['G', 'Grid or spotlight'],
  ['1 – 8', 'Send a reaction'],
  ['?', 'This list'],
  ['Esc', 'Close panels'],
];

export const ShortcutsModal = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose} title="Keyboard shortcuts" icon={<KeyboardIcon size={20} />} size="sm">
    <ul className="divide-y divide-line px-5 py-2 sm:px-6">
      {SHORTCUTS.map(([key, label]) => (
        <li key={key} className="flex items-center justify-between py-2.5 text-sm">
          <span className="text-fg-2">{label}</span>
          <span className="kbd">{key}</span>
        </li>
      ))}
    </ul>
  </Modal>
);
