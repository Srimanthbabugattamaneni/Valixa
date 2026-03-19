import Link from "next/link";
import { ROUTES } from "@/config/routes";

interface AuthCardProps {
  title: string;
  subtitle: string;
  error: string | null;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export default function AuthCard({ title, subtitle, error, footer, children }: AuthCardProps) {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <Link href={ROUTES.home} className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
          <span className="text-white text-sm font-bold">M</span>
        </div>
        <span className="font-semibold text-white text-xl tracking-tight">
          Vali<span className="gradient-text">xa</span>
        </span>
      </Link>

      {/* Card */}
      <div className="w-full max-w-sm glass rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
        <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {children}

        <p className="text-center text-sm text-gray-500 mt-6">{footer}</p>
      </div>
    </div>
  );
}
