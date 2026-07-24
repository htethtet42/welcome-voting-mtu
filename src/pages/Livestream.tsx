import { useState, useEffect, useRef } from 'react';
import { Radio, Eye, MessageCircle, Send } from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { LIVESTREAM_CHAT } from '../data';

const EXTRA_MESSAGES = [
  { name: 'Aba F.', msg: 'Just voted for my queen! 🙌', time: '' },
  { name: 'Nii A.', msg: 'Emmanuel has my full support 💪', time: '' },
  { name: 'Grace O.', msg: 'The QR code feature is so cool!!', time: '' },
  { name: 'Admin', msg: '🏆 Results announcement coming up soon!', time: '' },
  { name: 'Kwabena S.', msg: 'MTU best university 🇬🇭', time: '' },
  { name: 'Akua M.', msg: 'Prof K is unbeatable 🎓💯', time: '' },
  { name: 'Sena D.', msg: 'So proud of all the candidates!', time: '' },
  { name: 'Bright O.', msg: 'Let\'s goooo 🔥🔥🔥', time: '' },
];

export default function Livestream() {
  const { darkMode, totalVotes } = useElection();
  const [messages, setMessages] = useState(() => {
    const now = new Date();
    return LIVESTREAM_CHAT.map((m, i) => ({
      ...m,
      time: m.time || `${now.getHours()}:${String(now.getMinutes() - 12 + i).padStart(2, '0')}`,
    }));
  });
  const [inputMsg, setInputMsg] = useState('');
  const [viewers, setViewers] = useState(247);
  const chatRef = useRef<HTMLDivElement>(null);
  const extraIdx = useRef(0);

  const bg = darkMode ? '#0D0D1A' : '#F8F5EF';
  const cardBg = darkMode ? '#161624' : '#FFFFFF';
  const textPrimary = darkMode ? '#F5F0E8' : '#1A1A2A';
  const textMuted = darkMode ? '#9CA3AF' : '#6B7280';
  const border = darkMode ? 'rgba(212,175,55,0.12)' : 'rgba(212,175,55,0.25)';

  // Auto-add messages
  useEffect(() => {
    const id = setInterval(() => {
      if (extraIdx.current < EXTRA_MESSAGES.length) {
        const now = new Date();
        const m = EXTRA_MESSAGES[extraIdx.current];
        setMessages(prev => [
          ...prev,
          { ...m, time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}` },
        ]);
        extraIdx.current++;
      }
      setViewers(v => v + Math.floor(Math.random() * 5) - 1);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!inputMsg.trim()) return;
    const now = new Date();
    setMessages(prev => [
      ...prev,
      {
        name: 'You',
        msg: inputMsg.trim(),
        time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      },
    ]);
    setInputMsg('');
  };

  return (
    <div style={{ background: bg, color: textPrimary, minHeight: '100vh' }} className="pt-16">
      {/* Header */}
      <div
        className="py-6 px-4 sm:px-6 border-b"
        style={{ borderColor: border, background: darkMode ? '#161624' : '#FFFFFF' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold"
              style={{ background: 'rgba(255,77,141,0.15)', color: '#FF4D8D', border: '1px solid rgba(255,77,141,0.3)' }}
            >
              <span className="w-2 h-2 rounded-full bg-blush-500 animate-pulse" />
              LIVE
            </div>
            <div>
              <h1 className="font-display font-bold text-lg sm:text-xl" style={{ color: textPrimary }}>
                MTU Awards 2026 — Live Ceremony
              </h1>
              <p className="text-xs" style={{ color: textMuted }}>Official livestream of the voting & awards announcement</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm" style={{ color: textMuted }}>
              <Eye size={14} /> {viewers.toLocaleString()} watching
            </span>
            <span className="flex items-center gap-1.5 text-sm" style={{ color: '#D4AF37' }}>
              <MessageCircle size={14} /> {messages.length} messages
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>

          {/* Video Player */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Video embed area */}
            <div
              className="relative w-full rounded-2xl overflow-hidden border"
              style={{ aspectRatio: '16/9', background: '#000', borderColor: border }}
            >
              {/* Placeholder stream — replace src with actual YouTube embed when available */}
              <iframe
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&controls=1&rel=0"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="MTU Awards 2026 Livestream"
              />
              {/* LIVE badge overlay */}
              <div className="absolute top-4 left-4 pointer-events-none">
                <span
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold"
                  style={{ background: 'rgba(255,77,141,0.9)', color: '#fff' }}
                >
                  <Radio size={10} />
                  LIVE
                </span>
              </div>
            </div>

            {/* Stream info */}
            <div
              className="rounded-2xl p-5 border"
              style={{ background: cardBg, borderColor: border }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-xl mb-1" style={{ color: textPrimary }}>
                    MTU Campus Royalty & Excellence Awards 2026
                  </h2>
                  <p className="text-sm" style={{ color: textMuted }}>
                    Live coverage of the annual awards ceremony — voting results, performances, and the grand announcement.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-xl" style={{ color: '#D4AF37' }}>
                    {totalVotes.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: textMuted }}>total votes</p>
                </div>
              </div>

              {/* Upcoming */}
              <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${border}` }}>
                <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: textMuted }}>
                  Schedule
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    { time: '18:00', event: 'Opening ceremony', done: true },
                    { time: '18:30', event: 'Style category reveal', done: true },
                    { time: '19:00', event: 'Smart category reveal', done: false },
                    { time: '19:30', event: 'Queen announcement', done: false },
                    { time: '20:00', event: 'King announcement', done: false },
                    { time: '20:30', event: 'Grand finale & performances', done: false },
                  ].map(s => (
                    <div key={s.time} className="flex items-center gap-2.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.done ? '' : 'animate-pulse'}`}
                        style={{ background: s.done ? textMuted : '#D4AF37' }}
                      />
                      <span className="font-mono text-xs" style={{ color: s.done ? textMuted : '#D4AF37' }}>
                        {s.time}
                      </span>
                      <span className="text-sm" style={{ color: s.done ? textMuted : textPrimary }}>
                        {s.event}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Chat */}
          <div
            className="rounded-2xl border flex flex-col overflow-hidden"
            style={{ background: cardBg, borderColor: border, maxHeight: '80vh' }}
          >
            <div
              className="px-4 py-3 border-b flex items-center gap-2"
              style={{ borderColor: border }}
            >
              <MessageCircle size={14} style={{ color: '#D4AF37' }} />
              <span className="font-semibold text-sm" style={{ color: textPrimary }}>Live Chat</span>
              <span
                className="ml-auto font-mono text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,201,167,0.1)', color: '#00C9A7' }}
              >
                {messages.length}
              </span>
            </div>

            {/* Messages */}
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
              style={{ minHeight: 0 }}
            >
              {messages.map((m, i) => (
                <div key={i} className="flex gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold"
                    style={{
                      background: m.name === 'Admin'
                        ? 'rgba(212,175,55,0.2)'
                        : m.name === 'You'
                        ? 'rgba(0,201,167,0.2)'
                        : 'rgba(255,255,255,0.08)',
                      color: m.name === 'Admin' ? '#D4AF37' : m.name === 'You' ? '#00C9A7' : textMuted,
                    }}
                  >
                    {m.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: m.name === 'Admin' ? '#D4AF37' : m.name === 'You' ? '#00C9A7' : textPrimary,
                        }}
                      >
                        {m.name}
                      </span>
                      <span className="text-xs" style={{ color: textMuted }}>{m.time}</span>
                    </div>
                    <p className="text-sm break-words" style={{ color: textMuted }}>{m.msg}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t" style={{ borderColor: border }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                  style={{
                    background: darkMode ? '#0D0D1A' : '#F0EDE8',
                    color: textPrimary,
                    border: `1px solid ${border}`,
                  }}
                />
                <button
                  onClick={sendMessage}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:opacity-80"
                  style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
