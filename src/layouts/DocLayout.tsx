import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DocLayoutProps {
  children: ReactNode;
  title: string;
  icon: React.ElementType;
  kicker?: string;
  iconColor?: string;
  iconBg?: string;
  iconBorder?: string;
  prose?: boolean;
}

export default function DocLayout({ 
  children, 
  title, 
  icon: Icon,
  kicker = "Documentation",
  iconColor = "text-blue-400",
  iconBg = "bg-blue-500/10",
  iconBorder = "border-blue-500/20",
  prose = true
}: DocLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0d1316] text-white p-2 md:p-6 lg:p-10 flex items-start justify-center font-sans overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0d1117] border border-white/10 rounded-2xl md:rounded-[1.75rem] shadow-2xl flex flex-col overflow-hidden mb-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.04),transparent_30%)]" />

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 md:px-8 py-5 md:py-6 border-b border-white/[0.06] bg-[#0d1117]/95 backdrop-blur-md z-10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/docs')}
              className="p-2 md:p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5 md:w-5 md:h-5" />
            </button>
            <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl ${iconBg} border ${iconBorder} flex items-center justify-center flex-shrink-0 hidden sm:flex`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${iconColor} mb-0.5 md:mb-1`}>
                {kicker}
              </p>
              <h1 className="text-lg md:text-xl font-black tracking-tight text-white leading-tight">
                {title}
              </h1>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className={`p-5 md:p-8 relative z-0 ${prose ? 'prose prose-invert prose-sm md:prose-base max-w-none' : ''}`}>
          {prose && (
            <style>{`
              .prose h1 { font-weight: 900; letter-spacing: -0.02em; color: white; margin-bottom: 1rem; font-size: 1.5rem; }
              .prose h2 { font-weight: 800; letter-spacing: -0.01em; color: white; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; }
              .prose h3 { font-weight: 700; color: #e2e8f0; margin-top: 1.5rem; }
              .prose p { color: #94a3b8; line-height: 1.7; }
              .prose ul, .prose ol { color: #94a3b8; }
              .prose li::marker { color: #475569; }
              .prose a { color: #3b82f6; font-weight: 600; text-decoration: none; }
              .prose a:hover { text-decoration: underline; color: #60a5fa; }
              .prose strong { color: white; font-weight: 700; }
              .prose hr { border-color: rgba(255,255,255,0.05); margin: 2rem 0; }
            `}</style>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
