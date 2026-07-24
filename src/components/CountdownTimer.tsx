import { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function getTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

interface Props {
  target: Date;
  compact?: boolean;
  darkMode: boolean;
}

export default function CountdownTimer({ target, compact = false, darkMode }: Props) {
  const [time, setTime] = useState(() => getTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (time.expired) {
    return (
      <div className="text-center">
        <span
          className="font-mono text-sm font-medium px-3 py-1.5 rounded-full"
          style={{ color: '#FF4D8D', background: 'rgba(255,77,141,0.12)' }}
        >
          Voting Closed
        </span>
      </div>
    );
  }

  const units = [
    { label: 'Days', value: time.days },
    { label: 'Hrs', value: time.hours },
    { label: 'Min', value: time.minutes },
    { label: 'Sec', value: time.seconds },
  ];

  if (compact) {
    return (
      <span className="font-mono text-xs" style={{ color: '#D4AF37' }}>
        {String(time.days).padStart(2, '0')}d{' '}
        {String(time.hours).padStart(2, '0')}h{' '}
        {String(time.minutes).padStart(2, '0')}m{' '}
        {String(time.seconds).padStart(2, '0')}s
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {units.map(({ label, value }) => (
        <div key={label} className="flex flex-col items-center">
          <div
            className={`w-16 sm:w-20 h-16 sm:h-20 rounded-xl flex items-center justify-center border font-mono font-bold text-2xl sm:text-3xl transition-colors ${
              darkMode
                ? 'bg-night-800 border-gold-500/20 text-gold-400'
                : 'bg-white border-gold-500/30 text-gold-500'
            }`}
          >
            {String(value).padStart(2, '0')}
          </div>
          <span
            className="text-xs font-medium mt-1.5"
            style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
