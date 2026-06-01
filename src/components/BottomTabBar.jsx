// src/components/BottomTabBar.jsx — v22-fix
// Correct order per user spec:
//   Accueil · Réviser · Scan (FAB) · Classe · Cours
// Classe icon = MessageSquare (cleaner, what v18 had)

import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home as HomeIcon, GraduationCap, MessageSquare,
  BookOpen, Scan,
} from "lucide-react";

const TABS = [
  { id: "home",    path: "/",        label: "Accueil", icon: HomeIcon },
  { id: "reviser", path: "/reviser", label: "Réviser", icon: GraduationCap },
  { id: "scan",    path: "/scan",    label: "",        icon: Scan, isFAB: true },
  { id: "classe",  path: "/classe",  label: "Classe",  icon: MessageSquare },
  { id: "cours",   path: "/cours",   label: "Cours",   icon: BookOpen },
];

export default function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 pt-2 pb-safe">
      <div className="flex items-end justify-around max-w-md mx-auto relative">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          if (tab.isFAB) {
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate(tab.path)}
                className="relative -mt-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/40 ring-4 ring-white dark:ring-slate-950">
                  <Icon size={26} className="text-white" />
                </div>
              </motion.button>
            );
          }
          return (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-0.5 pt-1 pb-2 px-2 flex-1"
            >
              <Icon size={20} className={active ? "text-violet-600 dark:text-violet-400" : "text-slate-400 dark:text-slate-500"} />
              <span className={`text-[10px] font-bold ${active ? "text-violet-600 dark:text-violet-400" : "text-slate-400 dark:text-slate-500"}`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
