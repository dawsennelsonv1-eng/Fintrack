// src/components/AppShell.jsx — v22-fix
// Restores v18-style top header with bell + settings buttons.
// Admin badge is tucked into the header next to settings (only visible to admins).
// Header hides automatically on fullscreen routes (camera, classroom session).

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, Settings } from "lucide-react";
import BottomTabBar from "./BottomTabBar";
import PlanSwitcher from "./admin/PlanSwitcher";

// Routes that take over the full screen — hide top bar
const HIDE_TOPBAR_ON = ["/scan", "/classe", "/admin"];

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const hideTopBar = HIDE_TOPBAR_ON.some((p) =>
    p === "/classe"
      ? location.pathname === "/classe" || location.pathname.startsWith("/classe/") || location.search.includes("session=")
      : location.pathname.startsWith(p)
  );

  // Also hide on classroom session view (URL has ?session=)
  const inSession = location.pathname === "/classe" && location.search.includes("session=");
  const shouldHide = hideTopBar || inSession;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {!shouldHide && (
        <header className="fixed top-0 inset-x-0 z-20 px-4 pt-3 pb-2 pointer-events-none">
          <div className="flex items-center justify-end gap-2">
            <PlanSwitcher />
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {/* notifications page placeholder */}}
              className="pointer-events-auto w-9 h-9 rounded-full bg-white/85 dark:bg-slate-800/85 backdrop-blur-md flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate("/profile")}
              className="pointer-events-auto w-9 h-9 rounded-full bg-white/85 dark:bg-slate-800/85 backdrop-blur-md flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
              aria-label="Paramètres"
            >
              <Settings size={16} />
            </motion.button>
          </div>
        </header>
      )}

      <main className="relative">
        <Outlet />
      </main>

      <BottomTabBar />
    </div>
  );
}
