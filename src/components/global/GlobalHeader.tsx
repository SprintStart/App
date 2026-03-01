import { Link } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface GlobalHeaderProps {
  breadcrumbs?: Breadcrumb[];
}

export function GlobalHeader({ breadcrumbs }: GlobalHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Breadcrumbs */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 hover:text-blue-700">
              <Zap className="w-6 h-6" />
              <span className="hidden sm:inline">StartSprint</span>
            </Link>

            {breadcrumbs && breadcrumbs.length > 0 && (
              <>
                <ChevronRight className="w-5 h-5 text-gray-400 hidden sm:block" />
                <nav className="hidden sm:flex items-center gap-2 text-sm">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={index} className="flex items-center gap-2">
                      {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                      {crumb.href ? (
                        <Link to={crumb.href} className="text-gray-600 hover:text-gray-900">
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="text-gray-900 font-medium">{crumb.label}</span>
                      )}
                    </div>
                  ))}
                </nav>
              </>
            )}
          </div>

          {/* Teacher Login */}
          <Link
            to="/teacher"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Teacher Login
          </Link>
        </div>
      </div>
    </header>
  );
}
