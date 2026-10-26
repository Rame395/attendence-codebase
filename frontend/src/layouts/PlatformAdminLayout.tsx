import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { LogOut } from "lucide-react";
import { useAppSelector } from "../lib/hooks/redux";
import { logout } from "../lib/reducers/auth-reducer";
import Logo from "../components/logo/Logo";
import Avatar from "../components/common/Avatar";
import axiosInstance from "../config/ApiClient";

// platform admin ko minimal layout - sidebar chhaina, sabai kaam /PlatformAdmin ma
export default function PlatformAdminLayout() {
  const { authUser } = useAppSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  // platform admin ko naam /auth/me bata aaucha - email kahilyai dekhaindaina
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = (await axiosInstance.get("/auth/me")) as unknown as {
          data?: { username?: string | null; name?: string | null };
        };
        if (active) setProfileName(res?.data?.username || res?.data?.name || null);
      } catch {
        // silently fail
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const displayName = profileName || authUser?.name || authUser?.username || "Platform Admin";

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <section className="w-full bg-surface min-h-screen">
      <header className="bg-white border-b border-border py-2.5 px-3 sm:px-5 w-full shadow-sm flex justify-between items-center sticky top-0 z-30 gap-2">
        <div className="flex gap-2 sm:gap-3 items-center min-w-0">
          <Logo className="size-8 sm:size-10 shrink-0" />
          <h2 className="text-base sm:text-xl font-bold tracking-tight text-primary truncate">
            Platform Admin
          </h2>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-secondary/40 rounded-xl px-2 sm:px-3 py-1.5 transition-colors"
          >
            <Avatar name={displayName} size="sm" rounded="rounded-full" className="shadow-sm" />
            <span className="hidden sm:inline truncate max-w-[140px]">{displayName}</span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                role="menu"
                className="absolute end-0 top-12 z-20 w-44 overflow-hidden rounded-xl border border-border bg-white shadow-xl py-1"
              >
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 sm:px-5 py-4 sm:py-6">
        <Outlet />
      </main>
    </section>
  );
}
