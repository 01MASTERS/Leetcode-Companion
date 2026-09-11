'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useTrackerStore } from '@/store/useTrackerStore';
import { Stats } from '@/types';
import { LayoutDashboard, BarChart3, Settings, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { status } = useSession();
  const { sidebarOpen, toggleSidebar } = useTrackerStore();

  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const leetcodeUser = stats?.syncConfig?.leetcodeUser;

  // Hide sidebar completely on public landing page
  if (pathname === '/') return null;

  const navItems = [
    { name: 'Companies', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Statistics', href: '/statistics', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <motion.div
      animate={{ width: sidebarOpen ? 240 : 70 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="glass-blur border-r border-border flex flex-col h-screen sticky top-0 text-muted-foreground select-none z-30 relative"
    >
      {/* Floating Border Toggle Button (Linear/Notion style) */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-50 h-6 w-6 bg-card border border-border text-muted-foreground hover:text-foreground rounded-full flex items-center justify-center shadow-md cursor-pointer hover:scale-110 transition-all hover:bg-muted focus:outline-none"
        title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {/* Brand header */}
      <div className="h-16 flex items-center px-4 border-b border-border flex-shrink-0 overflow-hidden">
        <Link href="/" className="flex items-center gap-3 w-full justify-center sidebarOpen:justify-start group" title="Return to Homepage">
          <div className="flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="LC Tracker Logo" className="h-9 w-9 rounded-xl object-contain shadow-sm group-hover:scale-105 transition-transform" />
          </div>
          {sidebarOpen && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="font-bold text-foreground tracking-tight whitespace-nowrap group-hover:text-primary transition-colors"
            >
              LC Tracker
            </motion.span>
          )}
        </Link>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 py-6 px-3 flex flex-col gap-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard' 
            ? (pathname === '/dashboard' || pathname.startsWith('/company/'))
            : pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative cursor-pointer ${
                isActive
                  ? 'text-foreground bg-secondary border border-border shadow-inner'
                  : 'hover:text-foreground hover:bg-muted/50 border border-transparent'
              }`}
            >
              <div className={`transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-primary' : 'text-muted-foreground dark:text-zinc-500'}`}>
                <Icon className="h-5 w-5 flex-shrink-0" />
              </div>
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="truncate"
                >
                  {item.name}
                </motion.span>
              )}
              
              {/* Tooltip when collapsed */}
              {!sidebarOpen && (
                <div className="absolute left-16 bg-popover border border-border text-foreground text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Connected LeetCode account indicator in sidebar bottom */}
      {status === 'authenticated' && leetcodeUser && (
        <div className="p-3 border-t border-border mt-auto">
          {sidebarOpen ? (
            <a
              href={`https://leetcode.com/u/${leetcodeUser}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/80 hover:border-border hover:bg-muted/60 transition-all text-xs group"
              title={`Connected LeetCode account: ${leetcodeUser}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <div className="truncate text-left">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">LeetCode</div>
                  <div className="font-mono font-semibold text-foreground truncate group-hover:text-primary transition-colors text-xs">
                    {leetcodeUser}
                  </div>
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors ml-1" />
            </a>
          ) : (
            <a
              href={`https://leetcode.com/u/${leetcodeUser}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-2.5 rounded-xl bg-card border border-border/80 hover:bg-muted/60 transition-all group relative"
              title={`LeetCode: ${leetcodeUser}`}
            >
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <div className="absolute left-16 bg-popover border border-border text-foreground text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl z-50">
                LeetCode: {leetcodeUser}
              </div>
            </a>
          )}
        </div>
      )}
    </motion.div>
  );
}
