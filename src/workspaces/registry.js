// src/workspaces/registry.js
//
// Tier 5a — Workspace Registry
//
// Single source of truth for every workspace. To add a new workspace
// (e.g. AVS Recharge, Family, etc) you ONLY edit this file:
//   1. Add an entry to WORKSPACES below
//   2. Create a config file in this folder (see avs.js / personal.js)
//   3. (Optional) Add modules under src/modules/<workspace>/
//
// NO other file in the codebase should hard-code workspace IDs.
// Use the helper functions exported from here.
//
import personal from './personal';
import avs from './avs';

export const WORKSPACES = {
  personal,
  avs,
};

// Ordered list for UI (header switcher, etc)
export const WORKSPACE_LIST = [
  WORKSPACES.personal,
  WORKSPACES.avs,
];

// ─── Helper accessors ─────────────────────────────────────
export function getWorkspace(id) {
  return WORKSPACES[id] || WORKSPACES.personal;
}

export function getWorkspaceTabs(id) {
  const ws = getWorkspace(id);
  return ws.tabs || [];
}

export function getWorkspaceModule(workspaceId, tabId) {
  const ws = getWorkspace(workspaceId);
  return ws.modules?.[tabId] || null;
}

export function getWorkspaceAccent(id) {
  return getWorkspace(id).accent;
}

export function isWorkspaceEnabled(id) {
  const ws = WORKSPACES[id];
  return !!(ws && ws.enabled);
}
