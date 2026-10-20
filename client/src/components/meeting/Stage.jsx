import { useLayoutEffect, useRef, useState } from 'react'
import VideoTile from './VideoTile'

const GAP = 12;

const useSize = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
};

// Picks the column count that makes tiles as large as possible inside the stage.
const fitGrid = (n, width, height, ratio) => {
  let best = { cols: 1, w: 0 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const maxW = (width - GAP * (cols - 1)) / cols;
    const maxH = (height - GAP * (rows - 1)) / rows;
    const w = Math.min(maxW, maxH * ratio);
    if (w > best.w) best = { cols, w };
  }
  return best;
};

// Grid for everyone, or spotlight (one large tile + filmstrip) for a pinned person or a presenter.
const Stage = ({ tiles, spotlightId, speaking, pinnedId, onPin, sinkId, mirror, hostActionsFor }) => {
  const [ref, { width, height }] = useSize();
  const spotlight = spotlightId && tiles.length > 1 ? tiles.find((t) => t.id === spotlightId) : null;

  const tileProps = (t, size) => ({
    p: t,
    size,
    speaking: speaking.has(t.id),
    pinned: pinnedId === t.id,
    onPin: tiles.length > 1 ? () => onPin(pinnedId === t.id ? null : t.id) : undefined,
    sinkId,
    mirror,
    hostActions: hostActionsFor(t),
  });

  const portrait = width && height && width / height < 0.8;
  const ratio = portrait && tiles.length <= 2 ? 3 / 4 : 16 / 9;
  const { w } = width ? fitGrid(tiles.length, width, height, ratio) : { w: 0 };
  const size = w > 520 ? 'lg' : w > 260 ? 'md' : 'sm';
  const others = spotlight ? tiles.filter((t) => t.id !== spotlight.id) : [];

  // The outer box is always mounted so its size is known when switching layouts
  return (
    <div ref={ref} className="relative min-h-0 flex-1">
      {spotlight ? (
      <div className="absolute inset-0 flex flex-col gap-3 lg:flex-row">
        <div className="relative min-h-0 flex-1">
          <VideoTile {...tileProps(spotlight, 'lg')} className="absolute inset-0" />
        </div>
        <div className="flex shrink-0 gap-3 overflow-x-auto pb-1 lg:w-56 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0">
          {others.map((t) => (
            <VideoTile key={t.id} {...tileProps(t, 'sm')} className="aspect-video w-40 shrink-0 sm:w-48 lg:w-full" />
          ))}
        </div>
      </div>
      ) : (
      <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center" style={{ gap: GAP }}>
        {w > 0 && tiles.map((t) => (
          <VideoTile key={t.id} {...tileProps(t, size)} style={{ width: Math.floor(w), height: Math.floor(w / ratio) }} />
        ))}
      </div>
      )}
    </div>
  );
};

export default Stage
