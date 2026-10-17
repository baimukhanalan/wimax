const bars = [8, 14, 24, 35, 18, 12, 28, 43, 29, 16, 11, 21, 32, 52, 38, 20, 13, 25, 41, 30, 17, 10, 18, 29, 44, 31, 21, 12];

export function Waveform({ active = false }: { active?: boolean }) {
  return (
    <div className={`waveform ${active ? "waveform--active" : ""}`} aria-hidden="true">
      {bars.map((height, index) => (
        <span key={index} style={{ height, animationDelay: `${index * -42}ms` }} />
      ))}
    </div>
  );
}
