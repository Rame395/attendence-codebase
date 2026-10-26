import { useState, useEffect, useCallback, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { LogOut, UserCircle, Bell, Menu, PanelLeft, PanelLeftClose } from "lucide-react";
import { toast } from "sonner";
import { useAppSelector } from "../lib/hooks/redux";
import { logout, refreshAuthUser } from "../lib/reducers/auth-reducer";
import Logo from "../components/logo/Logo";
import { AdminSidebar } from "../components/ui/sidebar/AdminSidebar";
import Avatar from "../components/common/Avatar";
import CompanyAvatar from "../components/common/CompanyAvatar";
import axiosInstance from "../config/ApiClient";
import { useBrandTheme } from "../lib/hooks/useBrandTheme";
import { useCalendarPreference } from "../lib/hooks/useCalendarPreference";
import { formatDateTime, formatRelativeTime } from "../lib/nepali-date";

interface IHeaderNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  platform_admin: "Platform Admin",
  super_admin: "Super Admin",
  hr_admin: "HR / Admin",
  manager: "Manager",
  employee: "Employee",
};

// react-61-main ko AdminLayout pattern: header (logo + title | role dropdown) + sidebar + Outlet
export default function AdminLayout() {
  const { authUser } = useAppSelector((state) => state.auth);
  const { settings } = useAppSelector((state) => state.companySetting);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotes, setLatestNotes] = useState<IHeaderNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstPollRef = useRef(true);
  const location = useLocation();
  const calPref = useCalendarPreference();

  // profile page ko path role anusar farak huncha
  const profilePath = authUser?.role === "employee" ? "/employee/profile" : "/admin/profile";
  const notificationsPath = authUser?.role === "employee" ? "/employee/notifications" : "/admin/notifications";

  // header bell ko live data - count + latest list ekai call ma, naya aaye toast float garne
  const pollNotifications = useCallback(async (withToast = true) => {
    try {
      const res: any = await axiosInstance.get("/notifications");
      const list: IHeaderNotification[] = res.data || [];
      setUnreadCount(res.unread ?? list.filter((n) => !n.isRead).length);
      setLatestNotes(list.slice(0, 6));
      // pahilo poll ma bas seed garne (purano lai toast nagarne)
      if (firstPollRef.current) {
        firstPollRef.current = false;
        list.forEach((n) => knownIdsRef.current.add(n._id));
        return;
      }
      const fresh = list.filter((n) => !n.isRead && !knownIdsRef.current.has(n._id));
      list.forEach((n) => knownIdsRef.current.add(n._id));
      if (!withToast || fresh.length === 0 || document.hidden) return;
      // ekai choti dherai aaye 3 wota matra float garne (spam rokna) - click garyo bhane page ma jancha
      fresh.slice(0, 3).forEach((n) => {
        toast(n.title || "New notification", {
          description: n.message,
          duration: 6000,
          action: {
            label: "View",
            onClick: () => navigate(notificationsPath),
          },
        });
      });
    } catch {}
  }, [navigate, notificationsPath]);

  const fetchUnreadCount = useCallback(() => {
    pollNotifications(false);
  }, [pollNotifications]);

  // user change (login/logout) ma seen-cache reset - arko user ko purano lai toast nagarne
  const authUserKey = authUser?.email ?? null;
  useEffect(() => {
    knownIdsRef.current = new Set();
    firstPollRef.current = true;
  }, [authUserKey]);

  // unread notification count - page change + har 30 sec ma refresh (platform admin lai hudaina)
  const isPlatformAdmin = authUser?.role === "platform_admin";
  // company brand color - login pachi matra apply huncha (platform-admin lai default blue)
  useBrandTheme(!isPlatformAdmin);
  useEffect(() => {
    if (isPlatformAdmin) {
      setUnreadCount(0);
      setLatestNotes([]);
      return;
    }
    let active = true;
    const run = async () => {
      if (!active) return;
      await pollNotifications(true);
    };
    run();
    const interval = setInterval(run, 30000);
    return () => { active = false; clearInterval(interval); };
  }, [location.pathname, isPlatformAdmin, pollNotifications]);

  // close mobile drawer + bell dropdown on route change
  useEffect(() => {
    setSidebarOpen(false);
    setBellOpen(false);
  }, [location.pathname]);

  // platform admin ko sidebar chhaina - /admin vitra katai aayo bhane /PlatformAdmin pathaune
  useEffect(() => {
    if (authUser?.role === "platform_admin" && location.pathname.startsWith("/admin")) {
      navigate("/PlatformAdmin", { replace: true });
    }
  }, [authUser?.role, location.pathname, navigate]);

  // persist collapsed state
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
    } catch {}
  }, [sidebarCollapsed]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  // top-right ma name r role - redux bata
  const displayRole = authUser?.role ? roleLabels[authUser.role] : "";
  // /auth/me bata aune fresh naam (JWT ma naam hudaina - role matra dekhine bug thiyo)
  const [profileName, setProfileName] = useState<string | null>(null);
  // welcome/avatar ma email haina name dekhaune
  const displayName = profileName || authUser?.name || authUser?.username || "";
  // header avatar preview - /auth/me bata photo + naam lyaune, fresh permissions sync garne
  const [headerImage, setHeaderImage] = useState<string | { url: string } | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = (await axiosInstance.get("/auth/me")) as unknown as {
          data?: {
            username?: string | null;
            name?: string | null;
            profileImage?: { url: string } | null;
            employee?: { name?: string | null; profileImage?: { url: string } | null } | null;
            permissions?: string[];
            companyId?: string | null;
            company?: { _id: string; name: string; code: string } | null;
            calendarPreference?: "bs" | "ad";
          };
        };
        if (!active) return;
        const img = res?.data?.employee?.profileImage || res?.data?.profileImage || null;
        setHeaderImage(img);
        const freshName =
          res?.data?.employee?.name?.trim() ||
          res?.data?.username?.trim() ||
          res?.data?.name?.trim() ||
          null;
        setProfileName(freshName);
        dispatch(
          refreshAuthUser({
            permissions: res?.data?.permissions || [],
            companyId: res?.data?.companyId ?? null,
            company: res?.data?.company ?? null,
            ...(res?.data?.calendarPreference ? { calendarPreference: res.data.calendarPreference } : {}),
            ...(freshName ? { name: freshName, username: freshName } : {}),
          })
        );
      } catch {
        // silently fail - letter fallback dekhincha
      }
    })();
    return () => {
      active = false;
    };
  }, [location.pathname, dispatch]);

  return (
    <>
      <section className="w-full bg-surface min-h-screen">
        <header className="bg-white border-b border-border py-2.5 px-3 sm:px-5 w-full shadow-sm flex justify-between items-center sticky top-0 z-30 gap-2">
          <div className="flex gap-2 sm:gap-3 items-center min-w-0">
            {/* Mobile hamburger */}
            {authUser && (
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                aria-expanded={sidebarOpen}
                className="inline-flex md:hidden size-9 items-center justify-center rounded-xl hover:bg-secondary/50 text-slate-700 transition-colors shrink-0"
              >
                <Menu size={20} />
              </button>
            )}

            {/* Desktop collapse toggle */}
            {authUser && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed((c) => !c)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden md:inline-flex size-9 items-center justify-center rounded-xl hover:bg-secondary/50 text-slate-600 transition-colors shrink-0"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
              </button>
            )}

            {/* platform admin lai app logo, company user lai company logo (nabhaye default company image) */}
            {isPlatformAdmin ? (
              <Logo className="size-8 sm:size-10 shrink-0" />
            ) : (
              <CompanyAvatar
                name={authUser?.company?.name || settings.companyName || "C"}
                logo={authUser?.company?.logo}
                size="xs"
                className="sm:w-10 sm:h-10 sm:text-base"
              />
            )}
            <h2 className="hidden sm:block text-base sm:text-xl font-bold tracking-tight text-primary truncate">
              {settings.companyName || "Attendance Portal"}
            </h2>
            {/* very small: show short title */}
            <h2 className="sm:hidden text-sm font-bold tracking-tight text-primary truncate max-w-[110px]">
              {(settings.companyName || "Attendance").split(" ")[0]}
            </h2>
          </div>

          {/* role chip - click garda My Profile ra Logout dropdown */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* notification bell + live dropdown - platform admin lai hudaina */}
            {!isPlatformAdmin && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBellOpen((o) => !o)}
                  aria-label="Notifications"
                  aria-expanded={bellOpen}
                  className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary/50 transition-colors"
                >
                  <Bell size={19} className="text-slate-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <>
                    {/* backdrop - bahira click garyo bhane panel banda */}
                    <div className="fixed inset-0 z-10" onClick={() => setBellOpen(false)} />

                    <div className="absolute end-0 top-12 z-20 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-bold text-slate-800">Notifications</p>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-primary text-[11px] font-bold">{unreadCount} new</span>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        {latestNotes.length === 0 ? (
                          <p className="px-4 py-6 text-xs text-slate-400 text-center">No notifications yet</p>
                        ) : (
                          latestNotes.map((n) => (
                            <button
                              key={n._id}
                              type="button"
                              onClick={() => {
                                setBellOpen(false);
                                navigate(notificationsPath);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5"
                            >
                              {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                              <span className="min-w-0 flex-1">
                                <span className={`block text-[13px] truncate ${n.isRead ? "font-medium text-slate-600" : "font-bold text-slate-900"}`}>
                                  {n.title}
                                </span>
                                <span className="block text-xs text-slate-500 truncate">{n.message}</span>
                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                  {formatRelativeTime(n.createdAt)} · {formatDateTime(new Date(n.createdAt), calPref)}
                                </span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                      <NavLink
                        to={notificationsPath}
                        onClick={() => setBellOpen(false)}
                        className="block text-center px-4 py-2.5 text-xs font-bold text-primary hover:bg-secondary/40 border-t border-slate-100 transition-colors"
                      >
                        View all notifications
                      </NavLink>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-secondary/40 rounded-xl px-2 sm:px-3 py-1.5 transition-colors"
            >
              <Avatar
                name={displayName || displayRole || authUser?.email || "U"}
                imageUrl={headerImage}
                size="sm"
                rounded="rounded-full"
                className="shadow-sm"
              />
              <span className="hidden sm:flex flex-col items-start leading-tight min-w-0 max-w-[140px]">
                <span className="truncate font-semibold text-slate-800 text-[13px]">
                  {displayName || displayRole || authUser?.email || "User"}
                </span>
                {displayName && displayRole && (
                  <span className="truncate text-[10px] font-medium text-slate-400">{displayRole}</span>
                )}
              </span>
            </button>

            {menuOpen && (
              <>
                {/* backdrop - bahira click garyo bhane menu band */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />

                <div
                  role="menu"
                  className="absolute end-0 top-12 z-20 w-48 overflow-hidden rounded-xl border border-border bg-white shadow-xl py-1"
                >
                  <NavLink
                    to={profilePath}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-secondary/30 transition-colors"
                  >
                    <UserCircle size={16} />
                    My Profile
                  </NavLink>
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
          </div>
        </header>

        <main className="flex w-full gap-0 md:gap-3 px-0 md:px-3">
          {/* authUser cha matra sidebar dekhaune */}
          {authUser && (
            <AdminSidebar
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            />
          )}

          <section className="w-full min-w-0 bg-surface p-3 sm:p-3 mt-0 md:mt-3 rounded-none md:rounded-xl overflow-y-auto border-0 md:border border-border/50" style={{ height: "calc(100dvh - 56px)", maxHeight: "calc(100dvh - 56px)" }}>
            <Outlet context={{ refreshUnread: fetchUnreadCount }} />
          </section>
        </main>
      </section>
    </>
  );
}
