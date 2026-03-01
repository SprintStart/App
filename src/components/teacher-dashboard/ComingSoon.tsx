import { ReactNode } from 'react';
import { Clock } from 'lucide-react';

interface ComingSoonProps {
  icon?: string;
  title: string;
  message: string;
  bullets?: string[];
  statusLine?: string;
  cta?: string;
  children?: ReactNode;
}

export function ComingSoon({ icon, title, message, bullets, statusLine, cta }: ComingSoonProps) {
  return (
    <div className="max-w-2xl mx-auto py-16">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
            {icon ? (
              <span className="text-3xl">{icon}</span>
            ) : (
              <Clock className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
          <p className="text-gray-600 leading-relaxed text-base">{message}</p>
        </div>

        {bullets && bullets.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <ul className="space-y-2.5">
              {bullets.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5 shrink-0">&#10003;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {statusLine && (
          <p className="text-xs text-gray-500 text-center mb-6">{statusLine}</p>
        )}

        {cta && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-5 py-3.5 text-center">
            <p className="text-sm font-medium text-blue-700">{cta}</p>
          </div>
        )}
      </div>
    </div>
  );
}
