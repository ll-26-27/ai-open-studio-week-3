function size(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  return Math.max(1, Math.round(bytes / 1e3)) + " KB";
}

// The grid of stills and clips, shared by /live (this machine) and /live/nas (every machine, via the NAS).
export default function Gallery({ items }) {
  return (
    <ul className="live-grid">
      {items.map((item) => (
        <li className="live-item" key={item.src}>
          {item.type === "image"
            ? <a href={item.src} target="_blank" rel="noreferrer"><img src={item.src} alt={item.name} loading="lazy" /></a>
            : <video src={item.src} controls muted playsInline preload="metadata" />}
          <div className="live-caption"><span>{item.folder ? `${item.folder}/` : ""}{item.name}</span><span>{size(item.bytes)}</span></div>
          {item.description && <p className="live-description">{item.description}</p>}
        </li>
      ))}
    </ul>
  );
}
