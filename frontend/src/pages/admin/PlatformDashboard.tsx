import { useEffect, useState } from "react";
import { Factory, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../config/ApiClient";
import Companies from "./Companies";

interface IPlatformStats {
  totalCompanies: number;
  activeCompanies?: number;
  suspendedCompanies?: number;
  totalSuperAdmins: number;
  totalEmployees: number;
  totalUsers?: number;
}

// platform admin dashboard
export default function PlatformDashboard() {
  const [stats, setStats] = useState<IPlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const statsRes = (await axiosInstance.get("/companies/stats/overview")) as { data: IPlatformStats };
        if (!active) return;
        setStats(statsRes.data || null);
      } catch {
        if (active) toast.error("Failed to load platform stats");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const cards = stats
    ? [
        { label: "Total Companies", value: stats.totalCompanies, icon: Factory, bg: "bg-secondary", fg: "text-primary" },
        { label: "Active Companies", value: stats.activeCompanies ?? 0, icon: CheckCircle2, bg: "bg-green-50", fg: "text-green-700" },
        { label: "Suspended Companies", value: stats.suspendedCompanies ?? 0, icon: XCircle, bg: "bg-red-50", fg: "text-red-600" },
      ]
    : [];

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl bg-white border border-border shadow-sm p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.bg} ${c.fg}`}>
                  <Icon size={20} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{c.value}</p>
                <p className="text-xs text-slate-500 mt-1">{c.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <Companies />
    </div>
  );
}
