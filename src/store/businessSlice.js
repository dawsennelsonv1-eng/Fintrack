// src/store/businessSlice.js
// Tier 5b — AVS workspace state slice + sync engine
//
// Self-contained. Imports nothing from useStore.js. Designed to be
// merged into the Zustand store via `create()(...)` composition so we
// don't have to rewrite useStore.js.
//
// ─── Wiring into useStore.js ───────────────────────────────────
//
// In src/store/useStore.js, add this import near the top:
//
//     import { businessSlice } from './businessSlice';
//
// Inside the `create(persist((set, get) => ({...})))` call, add the
// spread AFTER personalSlice and BEFORE appSlice's closing brace:
//
//     ...personalSlice(set, get),
//     ...businessSlice(set, get),    // ← ADD THIS LINE
//     ...appSlice(set, get),
//
// In the `partialize` option of the persist config, add `business` to
// the persisted keys:
//
//     partialize: (s) => ({
//       app: s.app,
//       personal: s.personal,
//       business: s.business,         // ← ADD THIS LINE
//     }),
//
// In `hydrate()`, call `get().hydrateBusinessFromServer()` AFTER the
// existing personal hydration. See README for exact placement.
//
// That's the only useStore.js touchpoints. Everything else lives here.
//

import { avsApi, ApiError } from '../lib/api';

const uid = (prefix = 'avs') =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const stripMeta = ({ _pending, ...rest }) => rest;
const nowISO = () => new Date().toISOString();

// ════════════════════════════════════════════════════════════════════
// QUEUE HELPER — AVS-scoped
// ════════════════════════════════════════════════════════════════════
function enqueueAvs(set, get, entity, action, payload) {
  // Translate to French column names for entities backed by French tabs
  const wirePayload = toFrench(entity, payload);
  set((s) => ({
    business: {
      ...s.business,
      queue: [...(s.business?.queue || []), { entity, action, ...wirePayload }],
    },
  }));
  Promise.resolve().then(() => get().syncAvsQueue());
}

// ════════════════════════════════════════════════════════════════════
// FRENCH ↔ ENGLISH TRANSLATION (Round F)
// ════════════════════════════════════════════════════════════════════
//
// The server (Code.gs) reads/writes French tabs (SALES_PIPELINE,
// UTILISATEUR, WEB_INCOMING) using their actual French column names.
// The app uses clean English keys throughout (id, client, status, etc).
// These tables translate at the wire boundary.
//
// FR_TO_EN: server JSON → app state (called on hydrate)
// EN_TO_FR: app state → server payload (called in enqueueAvs)
//
const FR_TO_EN = {
  lead: {  // SALES_PIPELINE
    'ID_Lead': 'id',
    'Date': 'date',
    'Client': 'client',
    'Statut_Lead': 'leadStatus',
    'WhatsApp': 'whatsapp',
    'Source': 'source',
    'Passeport_Dispo?': 'passportAvailable',
    'Type_Carte': 'cardType',
    'Pack_Choisi': 'pack',
    'Promo_Appliquee': 'promoApplied',
    'Prix_Total': 'totalPrice',
    'Date_inscrip_Payé': 'dateInscriptionPaid',
    'Preuve_inscription': 'proofInscription',
    'Balance_Client': 'balanceClient',
    'Aide_1ere_Commande?': 'firstOrderHelp',
    'Statut_Paiement': 'paymentStatus',
    'Date_Rdv': 'rdvDate',
    'Rappel_J-1': 'reminderDayBefore',
    'Rappel_Matin': 'reminderMorning',
    'Rappel_1h_Avant': 'reminder1hBefore',
    'Relance_Phase1_Immediate': 'followUpPhase1',
    'Relance_Phase2_Tardive': 'followUpPhase2',
    'Compteur_Appels': 'callCount',
    'Assistant_responsable': 'assistantResponsible',
    'Notes': 'notes',
    'date_Total_payé': 'datePaidFull',
    'Assigné_Ops': 'assignedOps',
    'Statut_Ops': 'opsStatus',
    'Raison_Echec': 'failureReason',
    'Rdv_Aide_Commande': 'rdvHelp',
    'Carte_Physique_Recue?': 'physicalCardReceived',
    'Date_Reception': 'dateReception',
    'Lieu_Recuperation': 'pickupLocation',
    'Compagnie_Livraison': 'deliveryCompany',
    'Preuves_Reception': 'proofReception',
    'Start_Time': 'startTime',
    'End_Time': 'endTime',
    'Client_Rating_score': 'clientRating',
    'Review_text_format': 'reviewText',
    'Preuve_Paiement': 'paymentProof',
    'type_paiement': 'paymentType',
    'admin_flag': 'adminFlag',
    'Pay_Statut_Ops': 'payStatusOps',
    'Pay_Statut_Sales': 'payStatusSales',
  },
  staff: {  // UTILISATEUR
    'Nom': 'id',          // staff identified by Nom
    'Email': 'email',
    'Role': 'role',
    'Whatsapp': 'whatsapp',
    'Photo': 'photo',
    'Status': 'status',
  },
  rechargeOrder: {  // WEB_INCOMING
    'ID_Order': 'id',
    'Date': 'date',
    'Statut': 'status',
    'Client': 'client',
    'WhatsApp': 'whatsapp',
    'Service': 'service',
    'Plateforme': 'platform',
    'Tag_Info': 'tagInfo',
    'Montant_USD': 'amountUsd',
    'Montant_HTG': 'amountHtg',
    'Paiement': 'paymentMethod',
    'Code_Promo': 'promoCode',
    'Frais': 'fees',
    'Vitesse': 'speed',
    'Email': 'email',
    'Subscription': 'subscription',
    'Bénéfices': 'profit',
    'Prouf': 'proof',
    'Nom Fournisseur': 'supplierName',
    'Taux Fournisseur': 'supplierRate',
    'Frais fournisseur': 'supplierFee',
  },
};

// Build reverse maps (en→fr) lazily on first use
const EN_TO_FR = {};
Object.keys(FR_TO_EN).forEach((entity) => {
  const rev = {};
  const m = FR_TO_EN[entity];
  for (const fr in m) rev[m[fr]] = fr;
  EN_TO_FR[entity] = rev;
});

// Convert a single server row from FR keys to EN keys.
// Unknown keys pass through. Adds english `id` field as alias if not present.
function fromFrench(entity, row) {
  const map = FR_TO_EN[entity];
  if (!map || !row || typeof row !== 'object') return row;
  const out = {};
  for (const k in row) {
    const enKey = map[k] || k;
    out[enKey] = row[k];
  }
  return out;
}

function fromFrenchAll(entity, list) {
  if (!Array.isArray(list)) return list;
  return list.map((r) => fromFrench(entity, r));
}

// Convert an app payload from EN keys to FR keys (for write).
// Unknown keys pass through.
function toFrench(entity, payload) {
  const map = EN_TO_FR[entity];
  if (!map || !payload || typeof payload !== 'object') return payload;
  const out = {};
  for (const k in payload) {
    const frKey = map[k] || k;
    out[frKey] = payload[k];
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════
// MERGE-NOT-OVERWRITE (mirror of Personal's hydrate fix)
// ════════════════════════════════════════════════════════════════════
//
// Same contract as Personal: NEVER let the server overwrite local data
// with emptiness. If server returns an empty array, keep local. If it
// returns data, merge by id — server wins on conflict but local-only
// entries (e.g. recently created, not yet synced) are preserved.
//
function mergeById(local, fromServer) {
  if (!Array.isArray(fromServer) || fromServer.length === 0) return local || [];
  if (!Array.isArray(local)) return fromServer;
  const serverIds = new Set(fromServer.map((r) => r.id));
  const localOnly = local.filter((r) => !serverIds.has(r.id));
  return [...fromServer, ...localOnly];
}

// ════════════════════════════════════════════════════════════════════
// STAFF COMMISSION RULES (Marc per-card)
// ════════════════════════════════════════════════════════════════════
//
// Marc earns:
//   • 500 HTG for Virtuel-only
//   • 500 HTG for Physique-only
//   • 750 HTG for Physique + Virtuel
//
// Triggered when a lead transitions to leadStatus = '✅ Terminé'.
//
export function computeOpsCommission(lead) {
  const pack = String(lead.pack || '').trim();
  if (pack === 'Physique + Virtuel') return 750;
  if (pack === 'Virtuel') return 500;
  if (pack === 'Physique') return 500;
  return 500; // fallback
}

// Sales fixed bi-weekly amount per assistant
export const SALES_BIWEEKLY_HTG = 2500;
// Content monthly
export const CONTENT_MONTHLY_HTG = 7500;
// Sarah's required posts/day across 2 TikTok accounts
export const CONTENT_REQUIRED_POSTS_PER_DAY = 6;

// ── Recharge workspace defaults (v10) ──
export const RECHARGE_COMMISSION_RATE = 0.25;  // Marc gets 25% of order benefits
export const RECHARGE_CEO_SPLIT_PCT   = 0.75;  // You take 75% of net after costs
export const RECHARGE_DEFAULT_CYCLE   = 30;    // 30 days default; user can set to 15

// ════════════════════════════════════════════════════════════════════
// BUSINESS SLICE
// ════════════════════════════════════════════════════════════════════
export const businessSlice = (set, get) => ({
  business: {
    // ─── FR-tab data (mirrored from existing sheet) ─────────
    leads:             [],   // from SALES_PIPELINE
    rechargeOrders:    [],   // from WEB_INCOMING (Recharge workspace will use this)
    roi:               [],   // from ROI tab
    staff:             [],   // from UTILISATEUR

    // ─── EN-tab data (app-created) ──────────────────────────
    adSpend:           [],
    staffCommissions:  [],
    cardCosts:         [],
    clients:           [],   // CLIENTS_UNIFIED — aggregated LTV
    fxRates:           [],
    contentAdherence:  [],
    staffPayroll:      [],

    // ─── v9 additions (Tier 5f-final) ───────────────────────
    businessDebts:       [],
    businessDebtEvents:  [],
    businessExpenses:    [],

    // ─── v10 additions (Recharge workspace) ─────────────────
    rechargeCommissions: [],
    rechargePayouts:     [],
    rechargeConfig:      [],   // single-row config table; latest entry wins

    // ─── Ship 2: local-only payroll predictor config ────────
    // Stores cadence config for each sales/content staff member.
    // Format: { 'Jémima': { nextPayDate: '2026-05-19', intervalDays: 14, amount: 2500 }, ... }
    // Local-only (not synced to sheet) — pure UI state to drive auto-
    // generation of upcoming payroll entries.
    payrollSchedule:  {},
    payrollSetupComplete: false,

    // ─── Sync state (AVS-scoped) ────────────────────────────
    queue:        [],
    lastSyncAt:   null,
    syncing:      false,
    syncError:    null,
    syncLog:      [],
  },

  // ═══════════════════════════════════════════════════════════
  // LEAD CRUD (writes to SALES_PIPELINE, FR-headered sheet)
  // ═══════════════════════════════════════════════════════════
  addLead: (input) => {
    const id = input.id || uid('lead');
    const lead = {
      id,
      date: input.date || nowISO(),
      client: input.client || '',
      leadStatus: input.leadStatus || '🔴 À Faire',
      whatsapp: input.whatsapp || '',
      source: input.source || '',
      passportAvailable: input.passportAvailable || '',
      cardType: input.cardType || 'Meru',
      pack: input.pack || 'Physique',
      promo: input.promo || '',
      totalPrice: Number(input.totalPrice) || 0,
      datePaidDeposit: input.datePaidDeposit || '',
      paymentStatus: input.paymentStatus || '',
      rdvDate: input.rdvDate || '',
      assistantResponsible: input.assistantResponsible || '',
      notes: input.notes || '',
      datePaidFull: input.datePaidFull || '',
      assignedOps: input.assignedOps || '',
      opsStatus: input.opsStatus || '🔴 À Faire',
      rdvAideCommande: input.rdvAideCommande || '',
      dateReception: input.dateReception || '',
      startTime: input.startTime || '',
      endTime: input.endTime || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ business: { ...s.business, leads: [lead, ...s.business.leads] } }));
    enqueueAvs(set, get, 'lead', 'create', stripMeta(lead));
    return lead;
  },

  updateLead: (id, patch) => {
    let updated = null;
    let prevStatus = null;
    set((s) => ({
      business: {
        ...s.business,
        leads: s.business.leads.map((l) => {
          if (l.id !== id) return l;
          prevStatus = l.leadStatus;
          updated = { ...l, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'lead', 'update', stripMeta(updated));

    // ─── Auto-create Marc's commission on transition to Terminé ──
    if (
      updated &&
      prevStatus !== '✅ Terminé' &&
      updated.leadStatus === '✅ Terminé' &&
      updated.assignedOps
    ) {
      get().recordOpsCommission(updated);
    }

    return updated;
  },

  removeLead: (id) => {
    set((s) => ({
      business: { ...s.business, leads: s.business.leads.filter((l) => l.id !== id) },
    }));
    enqueueAvs(set, get, 'lead', 'delete', { id });
  },

  // ═══════════════════════════════════════════════════════════
  // AD SPEND
  // ═══════════════════════════════════════════════════════════
  addAdSpend: (input) => {
    const ad = {
      id: input.id || uid('ad'),
      date: input.date || nowISO(),
      campaignName: input.campaignName || '',
      product: input.product || '',
      platform: input.platform || '',
      spendAmount: Number(input.spendAmount) || 0,
      spendCurrency: input.spendCurrency || 'USD',
      leadsAttributed: Number(input.leadsAttributed) || 0,
      kind: input.kind || 'paid',  // 'paid' | 'organic'
      notes: input.notes || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({ business: { ...s.business, adSpend: [ad, ...s.business.adSpend] } }));
    enqueueAvs(set, get, 'adSpend', 'create', stripMeta(ad));
    return ad;
  },

  updateAdSpend: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        adSpend: s.business.adSpend.map((a) => {
          if (a.id !== id) return a;
          updated = { ...a, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'adSpend', 'update', stripMeta(updated));
  },

  removeAdSpend: (id) => {
    set((s) => ({
      business: { ...s.business, adSpend: s.business.adSpend.filter((a) => a.id !== id) },
    }));
    enqueueAvs(set, get, 'adSpend', 'delete', { id });
  },

  // ═══════════════════════════════════════════════════════════
  // STAFF COMMISSIONS (Marc per-card)
  // ═══════════════════════════════════════════════════════════
  recordOpsCommission: (lead) => {
    const amount = computeOpsCommission(lead);
    const comm = {
      id: uid('comm'),
      date: nowISO(),
      staffName: lead.assignedOps || 'Marc',
      role: 'Ops',
      linkedLeadId: lead.id,
      commissionAmount: amount,
      currency: 'HTG',
      status: 'pending',
      paidDate: '',
      notes: `${lead.pack} card for ${lead.client}`,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: {
        ...s.business,
        staffCommissions: [comm, ...s.business.staffCommissions],
      },
    }));
    enqueueAvs(set, get, 'staffCommission', 'create', stripMeta(comm));
    return comm;
  },

  markCommissionPaid: (id) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        staffCommissions: s.business.staffCommissions.map((c) => {
          if (c.id !== id) return c;
          updated = {
            ...c,
            status: 'paid',
            paidDate: nowISO(),
            updatedAt: nowISO(),
            _pending: true,
          };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'staffCommission', 'update', stripMeta(updated));
  },

  // ═══════════════════════════════════════════════════════════
  // STAFF PAYROLL (Jémima/Christelle bi-weekly, Sarah monthly)
  // ═══════════════════════════════════════════════════════════
  recordPayroll: (input) => {
    const p = {
      id: input.id || uid('pay'),
      date: input.date || nowISO(),
      staffName: input.staffName,
      periodStart: input.periodStart || '',
      periodEnd: input.periodEnd || '',
      amount: Number(input.amount) || 0,
      currency: input.currency || 'HTG',
      type: input.type || 'salary',  // 'salary' | 'commission_payout' | 'bonus'
      status: input.status || 'pending',
      paidDate: input.paidDate || '',
      notes: input.notes || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: { ...s.business, staffPayroll: [p, ...s.business.staffPayroll] },
    }));
    enqueueAvs(set, get, 'staffPayroll', 'create', stripMeta(p));
    return p;
  },

  markPayrollPaid: (id) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        staffPayroll: s.business.staffPayroll.map((p) => {
          if (p.id !== id) return p;
          updated = {
            ...p, status: 'paid', paidDate: nowISO(),
            updatedAt: nowISO(), _pending: true,
          };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'staffPayroll', 'update', stripMeta(updated));
  },

  // ═══════════════════════════════════════════════════════════
  // CONTENT ADHERENCE (Sarah's daily 6 posts)
  // ═══════════════════════════════════════════════════════════
  logContentAdherence: ({ date, staffName = 'Sarah', actualPosts, accounts = '', notes = '' }) => {
    const entry = {
      id: uid('cnt'),
      date: date || nowISO(),
      staffName,
      requiredPosts: CONTENT_REQUIRED_POSTS_PER_DAY,
      actualPosts: Number(actualPosts) || 0,
      accounts,
      notes,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: {
        ...s.business,
        contentAdherence: [entry, ...s.business.contentAdherence],
      },
    }));
    enqueueAvs(set, get, 'contentAdherence', 'create', stripMeta(entry));
    return entry;
  },

  updateContentAdherence: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        contentAdherence: s.business.contentAdherence.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'contentAdherence', 'update', stripMeta(updated));
    return updated;
  },

  removeContentAdherence: (id) => {
    set((s) => ({
      business: {
        ...s.business,
        contentAdherence: s.business.contentAdherence.filter((c) => c.id !== id),
      },
    }));
    enqueueAvs(set, get, 'contentAdherence', 'delete', { id });
  },

  // ═══════════════════════════════════════════════════════════
  // COMMISSION / PAYROLL EDIT + DELETE (Ship 2)
  // ═══════════════════════════════════════════════════════════
  markCommissionUnpaid: (id) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        staffCommissions: s.business.staffCommissions.map((c) => {
          if (c.id !== id) return c;
          updated = {
            ...c, status: 'pending', paidDate: '',
            updatedAt: nowISO(), _pending: true,
          };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'staffCommission', 'update', stripMeta(updated));
  },

  updateCommission: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        staffCommissions: s.business.staffCommissions.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'staffCommission', 'update', stripMeta(updated));
    return updated;
  },

  removeCommission: (id) => {
    set((s) => ({
      business: {
        ...s.business,
        staffCommissions: s.business.staffCommissions.filter((c) => c.id !== id),
      },
    }));
    enqueueAvs(set, get, 'staffCommission', 'delete', { id });
  },

  markPayrollUnpaid: (id) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        staffPayroll: s.business.staffPayroll.map((p) => {
          if (p.id !== id) return p;
          updated = {
            ...p, status: 'pending', paidDate: '',
            updatedAt: nowISO(), _pending: true,
          };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'staffPayroll', 'update', stripMeta(updated));
  },

  updatePayroll: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        staffPayroll: s.business.staffPayroll.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'staffPayroll', 'update', stripMeta(updated));
    return updated;
  },

  removePayroll: (id) => {
    set((s) => ({
      business: {
        ...s.business,
        staffPayroll: s.business.staffPayroll.filter((p) => p.id !== id),
      },
    }));
    enqueueAvs(set, get, 'staffPayroll', 'delete', { id });
  },

  // ═══════════════════════════════════════════════════════════
  // PAYROLL PREDICTOR (Ship 2)
  // ═══════════════════════════════════════════════════════════
  //
  // Onboarding flow: user sets next pay date + cadence for each staff
  // member. We immediately generate 6 months of pending entries.
  //
  // Schedule shape:
  //   { 'Jémima': { nextPayDate: 'YYYY-MM-DD', intervalDays: 14, amount: 2500, currency: 'HTG' }, ... }
  //
  setupPayrollSchedule: (config) => {
    const HORIZON_MONTHS = 6;
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + HORIZON_MONTHS);

    set((s) => ({
      business: {
        ...s.business,
        payrollSchedule: config,
        payrollSetupComplete: true,
      },
    }));

    // Generate upcoming entries for each staff member
    Object.entries(config).forEach(([staffName, cfg]) => {
      if (!cfg.nextPayDate || !cfg.intervalDays) return;
      const start = new Date(cfg.nextPayDate);
      let cursor = new Date(start);
      while (cursor <= horizon) {
        const dateStr = cursor.toISOString().slice(0, 10);
        // Skip if already scheduled (avoids duplicates on re-setup)
        const exists = get().business.staffPayroll.some((p) =>
          p.staffName === staffName &&
          p.status === 'pending' &&
          String(p.periodEnd).slice(0, 10) === dateStr
        );
        if (!exists) {
          const periodStart = new Date(cursor);
          periodStart.setDate(periodStart.getDate() - cfg.intervalDays);
          get().recordPayroll({
            staffName,
            type: 'salary',
            amount: cfg.amount,
            currency: cfg.currency || 'HTG',
            periodStart: periodStart.toISOString().slice(0, 10),
            periodEnd: dateStr,
            notes: 'Auto-generated · ' + (cfg.intervalDays === 14 ? 'bi-weekly' : cfg.intervalDays === 30 ? 'monthly' : `${cfg.intervalDays}d cadence`),
            status: 'pending',
          });
        }
        cursor.setDate(cursor.getDate() + cfg.intervalDays);
      }
    });
  },

  // Allow user to skip the onboarding card without setting up schedules
  skipPayrollSetup: () => {
    set((s) => ({
      business: { ...s.business, payrollSetupComplete: true },
    }));
  },

  // Allow user to redo setup (e.g. after Sarah's pay date changes)
  resetPayrollSetup: () => {
    set((s) => ({
      business: { ...s.business, payrollSetupComplete: false },
    }));
  },

  // ═══════════════════════════════════════════════════════════
  // CARD COSTS (COGS for margin calculations)
  // ═══════════════════════════════════════════════════════════
  addCardCost: (input) => {
    const c = {
      id: uid('cc'),
      typeCarte: input.typeCarte || 'Meru',
      pack: input.pack || 'Physique',
      supplierCost: Number(input.supplierCost) || 0,
      currency: input.currency || 'USD',
      effectiveDate: input.effectiveDate || nowISO(),
      notes: input.notes || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: { ...s.business, cardCosts: [c, ...s.business.cardCosts] },
    }));
    enqueueAvs(set, get, 'cardCost', 'create', stripMeta(c));
    return c;
  },

  updateCardCost: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        cardCosts: s.business.cardCosts.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'cardCost', 'update', stripMeta(updated));
  },

  // ═══════════════════════════════════════════════════════════
  // CLIENTS_UNIFIED — recomputed from leads + recharges
  // ═══════════════════════════════════════════════════════════
  //
  // WhatsApp is the join key. This rebuilds the unified table from
  // both leads (cards) and rechargeOrders (recharges) so LTV/CAC
  // selectors work across workspaces. Called automatically after
  // each hydrate, or manually via the Clients module's refresh button.
  //
  rebuildClientsUnified: () => {
    const state = get().business;
    const byWhatsApp = new Map();

    const normalize = (wa) => String(wa || '').replace(/\D/g, '').slice(-8);

    // From leads (cards)
    state.leads.forEach((l) => {
      const key = normalize(l.whatsapp);
      if (!key) return;
      const existing = byWhatsApp.get(key) || {
        id: 'cli_' + key,
        whatsapp: l.whatsapp,
        name: l.client,
        email: '',
        firstSeenDate: l.date,
        sourceFirstTouch: l.source,
        totalCardsBought: 0,
        totalCardRevenue: 0,
        totalRecharges: 0,
        totalRechargeRevenue: 0,
        ltvTotal: 0,
        lastActivityDate: l.date,
        tags: '',
        notes: '',
      };
      if (l.leadStatus === '✅ Terminé') {
        existing.totalCardsBought += 1;
        existing.totalCardRevenue += Number(l.totalPrice) || 0;
      }
      if (new Date(l.date) > new Date(existing.lastActivityDate)) {
        existing.lastActivityDate = l.date;
      }
      if (new Date(l.date) < new Date(existing.firstSeenDate)) {
        existing.firstSeenDate = l.date;
        existing.sourceFirstTouch = l.source || existing.sourceFirstTouch;
      }
      byWhatsApp.set(key, existing);
    });

    // From rechargeOrders
    state.rechargeOrders.forEach((r) => {
      const key = normalize(r.whatsapp);
      if (!key) return;
      const existing = byWhatsApp.get(key) || {
        id: 'cli_' + key,
        whatsapp: r.whatsapp,
        name: r.client,
        email: r.email || '',
        firstSeenDate: r.date,
        sourceFirstTouch: r.platform || '',
        totalCardsBought: 0,
        totalCardRevenue: 0,
        totalRecharges: 0,
        totalRechargeRevenue: 0,
        ltvTotal: 0,
        lastActivityDate: r.date,
        tags: '',
        notes: '',
      };
      if (r.status === 'Terminé') {
        existing.totalRecharges += 1;
        existing.totalRechargeRevenue += Number(r.amountUsd) || 0;
      }
      if (new Date(r.date) > new Date(existing.lastActivityDate)) {
        existing.lastActivityDate = r.date;
      }
      byWhatsApp.set(key, existing);
    });

    // Compute LTV (in USD; HTG card revenue converted at 150)
    const HTG_PER_USD = 150;
    const clients = Array.from(byWhatsApp.values()).map((c) => ({
      ...c,
      ltvTotal:
        Number(c.totalCardRevenue) / HTG_PER_USD +
        Number(c.totalRechargeRevenue),
      updatedAt: nowISO(),
    }));

    set((s) => ({ business: { ...s.business, clients } }));
    return clients;
  },

  // ═══════════════════════════════════════════════════════════
  // BUSINESS DEBTS (v9)
  // ═══════════════════════════════════════════════════════════
  //
  // AVS-scoped debts: suppliers you owe (Gemini Express, card supplier)
  // and client deposits you owe back. Mirrors Personal's Debt module
  // shape but separate so AVS P&L doesn't pollute Personal net worth.
  //
  addBusinessDebt: (input) => {
    const debt = {
      id: input.id || uid('bdebt'),
      creditor: input.creditor || '',
      principal: Number(input.principal) || 0,
      currency: input.currency || 'HTG',
      direction: input.direction || 'owe',       // 'owe' | 'receivable'
      kind: input.kind || 'supplier',
      dueDate: input.dueDate || '',
      status: input.status || 'open',
      interestRate: Number(input.interestRate) || 0,
      interestType: input.interestType || 'simple',
      notes: input.notes || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: { ...s.business, businessDebts: [debt, ...s.business.businessDebts] },
    }));
    enqueueAvs(set, get, 'businessDebt', 'create', stripMeta(debt));
    return debt;
  },

  updateBusinessDebt: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        businessDebts: s.business.businessDebts.map((d) => {
          if (d.id !== id) return d;
          updated = { ...d, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'businessDebt', 'update', stripMeta(updated));
    return updated;
  },

  removeBusinessDebt: (id) => {
    set((s) => ({
      business: {
        ...s.business,
        businessDebts: s.business.businessDebts.filter((d) => d.id !== id),
      },
    }));
    enqueueAvs(set, get, 'businessDebt', 'delete', { id });
  },

  // Log a repayment against a debt — appends to BUSINESS_DEBT_EVENTS
  // and (if it brings principal to zero) marks the debt paid.
  repayBusinessDebt: (debtId, amount, notes = '') => {
    const debt = get().business.businessDebts.find((d) => d.id === debtId);
    if (!debt) return null;
    const amt = Number(amount) || 0;
    if (amt <= 0) return null;
    const events = get().business.businessDebtEvents.filter((e) => e.debtId === debtId);
    const totalRepaid = events
      .filter((e) => e.type === 'repayment')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const balanceBefore = (Number(debt.principal) || 0) - totalRepaid;
    const balanceAfter = Math.max(0, balanceBefore - amt);

    const event = {
      id: uid('bdebte'),
      debtId,
      type: 'repayment',
      amount: amt,
      currency: debt.currency,
      balanceAfter,
      interestPaid: 0,
      notes,
      date: nowISO(),
      createdAt: nowISO(),
      _pending: true,
    };

    set((s) => ({
      business: {
        ...s.business,
        businessDebtEvents: [event, ...s.business.businessDebtEvents],
      },
    }));
    enqueueAvs(set, get, 'businessDebtEvent', 'create', stripMeta(event));

    // Auto-mark paid if fully repaid
    if (balanceAfter === 0 && debt.status !== 'paid') {
      get().updateBusinessDebt(debtId, { status: 'paid' });
    } else if (balanceAfter < (Number(debt.principal) || 0) && debt.status === 'open') {
      get().updateBusinessDebt(debtId, { status: 'partial' });
    }
    return event;
  },

  // ═══════════════════════════════════════════════════════════
  // BUSINESS EXPENSES (v9)
  // ═══════════════════════════════════════════════════════════
  //
  // Operating expenses: rent, internet, phone, equipment, transport.
  // Picked up by the P&L calculation as a cost line.
  //
  addBusinessExpense: (input) => {
    const exp = {
      id: input.id || uid('bexp'),
      date: input.date || nowISO(),
      category: input.category || 'other',
      description: input.description || '',
      amount: Number(input.amount) || 0,
      currency: input.currency || 'HTG',
      recurring: input.recurring || 'one-off',
      paidTo: input.paidTo || '',
      paymentMethod: input.paymentMethod || '',
      notes: input.notes || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: { ...s.business, businessExpenses: [exp, ...s.business.businessExpenses] },
    }));
    enqueueAvs(set, get, 'businessExpense', 'create', stripMeta(exp));
    return exp;
  },

  updateBusinessExpense: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        businessExpenses: s.business.businessExpenses.map((e) => {
          if (e.id !== id) return e;
          updated = { ...e, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'businessExpense', 'update', stripMeta(updated));
    return updated;
  },

  removeBusinessExpense: (id) => {
    set((s) => ({
      business: {
        ...s.business,
        businessExpenses: s.business.businessExpenses.filter((e) => e.id !== id),
      },
    }));
    enqueueAvs(set, get, 'businessExpense', 'delete', { id });
  },

  // ═══════════════════════════════════════════════════════════
  // RECHARGE WORKSPACE (v10)
  // ═══════════════════════════════════════════════════════════
  //
  // Recharge orders are populated by make.com into WEB_INCOMING. Marc
  // marks orders Terminé in his own app. This app is monitoring +
  // analytics, plus Marc's commission ledger + CEO payouts.
  //
  // If the user manually flips a recharge order's status here, we
  // auto-create a Marc commission for that order (25% of profit).
  //

  // Returns the current config row (or defaults if none stored yet)
  getRechargeConfig: () => {
    const list = get().business.rechargeConfig || [];
    if (list.length === 0) {
      return {
        id: 'default',
        cycleDays: RECHARGE_DEFAULT_CYCLE,
        ceoSplitPct: RECHARGE_CEO_SPLIT_PCT,
        commissionRate: RECHARGE_COMMISSION_RATE,
        cycleStartDate: nowISO().slice(0, 10),
        lastPayoutDate: '',
        currency: 'HTG',
        notes: '',
      };
    }
    return list[0];
  },

  // Persist config to sheet
  saveRechargeConfig: (patch) => {
    const current = get().getRechargeConfig();
    const updated = {
      ...current,
      ...patch,
      id: current.id === 'default' ? uid('rcfg') : current.id,
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: {
        ...s.business,
        rechargeConfig: [updated], // single-row, replaces
      },
    }));
    const action = current.id === 'default' ? 'create' : 'update';
    if (current.id === 'default') updated.createdAt = nowISO();
    enqueueAvs(set, get, 'rechargeConfig', action, stripMeta(updated));
    return updated;
  },

  // Update an order's status — currently a stub since Marc owns this.
  // If the user does change a status here, we mirror to WEB_INCOMING
  // AND auto-create a commission when the new status is 'Terminé'.
  updateRechargeOrderStatus: (orderId, newStatus) => {
    const order = get().business.rechargeOrders.find((o) => o.id === orderId);
    if (!order) return null;
    const wasTermine = String(order.status).toLowerCase().includes('termin');
    const nowTermine = String(newStatus).toLowerCase().includes('termin');

    const updated = { ...order, status: newStatus, updatedAt: nowISO(), _pending: true };
    set((s) => ({
      business: {
        ...s.business,
        rechargeOrders: s.business.rechargeOrders.map((o) => o.id === orderId ? updated : o),
      },
    }));
    enqueueAvs(set, get, 'rechargeOrder', 'update', stripMeta(updated));

    // Newly Terminé → auto-create Marc commission (only if not already created)
    if (!wasTermine && nowTermine) {
      get().recordRechargeCommissionForOrder(order);
    }
    return updated;
  },

  // Create Marc's commission for a completed order, if not already there
  recordRechargeCommissionForOrder: (order) => {
    const cfg = get().getRechargeConfig();
    const rate = Number(cfg.commissionRate) || RECHARGE_COMMISSION_RATE;
    const benefit = Number(order.profit) || 0;
    if (benefit <= 0) return null;
    const orderIdStr = order.id != null ? String(order.id) : null;
    if (!orderIdStr) return null;

    // Dedup: any commission with this orderId (string-compare to be safe)
    const existing = get().business.rechargeCommissions.find(
      (c) => c.orderId != null && String(c.orderId) === orderIdStr
    );
    if (existing) return existing;

    const commission = {
      id: uid('rcom'),
      orderId: orderIdStr,
      date: nowISO(),
      staffName: 'Marc',
      orderBenefit: benefit,
      commissionRate: rate,
      commissionAmount: Math.round(benefit * rate),
      currency: 'HTG',
      status: 'pending',
      paidDate: '',
      notes: `${order.service || 'Recharge'} · ${order.client || order.tagInfo || ''}`,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };
    set((s) => ({
      business: {
        ...s.business,
        rechargeCommissions: [commission, ...s.business.rechargeCommissions],
      },
    }));
    enqueueAvs(set, get, 'rechargeCommission', 'create', stripMeta(commission));
    return commission;
  },

  markRechargeCommissionPaid: (id) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        rechargeCommissions: s.business.rechargeCommissions.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, status: 'paid', paidDate: nowISO(), updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'rechargeCommission', 'update', stripMeta(updated));
  },

  markRechargeCommissionUnpaid: (id) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        rechargeCommissions: s.business.rechargeCommissions.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, status: 'pending', paidDate: '', updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'rechargeCommission', 'update', stripMeta(updated));
  },

  updateRechargeCommission: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        rechargeCommissions: s.business.rechargeCommissions.map((c) => {
          if (c.id !== id) return c;
          updated = { ...c, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'rechargeCommission', 'update', stripMeta(updated));
    return updated;
  },

  removeRechargeCommission: (id) => {
    set((s) => ({
      business: {
        ...s.business,
        rechargeCommissions: s.business.rechargeCommissions.filter((c) => c.id !== id),
      },
    }));
    enqueueAvs(set, get, 'rechargeCommission', 'delete', { id });
  },

  // Backfill commissions for every Terminé order missing one.
  // Useful first-time after hydrating the existing 168 historical orders.
  backfillRechargeCommissions: () => {
    const orders = get().business.rechargeOrders || [];
    const existing = get().business.rechargeCommissions || [];
    // Normalize orderIds to strings — sheet may return number for some, string for others.
    // Without this, "1234" !== 1234 and duplicates get created on every hydrate.
    const existingByOrder = new Set(
      existing.map((c) => c.orderId != null ? String(c.orderId) : null).filter(Boolean)
    );

    const cfg = get().getRechargeConfig();
    const rate = Number(cfg.commissionRate) || RECHARGE_COMMISSION_RATE;

    const newCommissions = [];
    orders.forEach((o) => {
      const isTerm = String(o.status || '').toLowerCase().includes('termin');
      if (!isTerm) return;
      const benefit = Number(o.profit) || 0;
      if (benefit <= 0) return;
      const orderIdStr = o.id != null ? String(o.id) : null;
      if (!orderIdStr) return;
      if (existingByOrder.has(orderIdStr)) return;
      existingByOrder.add(orderIdStr);
      newCommissions.push({
        id: uid('rcom'),
        orderId: orderIdStr,           // store as string consistently
        date: nowISO(),
        staffName: 'Marc',
        orderBenefit: benefit,
        commissionRate: rate,
        commissionAmount: Math.round(benefit * rate),
        currency: 'HTG',
        status: 'pending',
        paidDate: '',
        notes: `${o.service || 'Recharge'} · ${o.client || o.tagInfo || ''}`,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        _pending: true,
      });
    });

    if (newCommissions.length === 0) return 0;

    set((s) => ({
      business: {
        ...s.business,
        rechargeCommissions: [...newCommissions, ...s.business.rechargeCommissions],
      },
    }));
    newCommissions.forEach((c) => {
      enqueueAvs(set, get, 'rechargeCommission', 'create', stripMeta(c));
    });
    return newCommissions.length;
  },

  // Record a CEO payout for the current cycle.
  // Computes the proposed amounts; user confirms.
  recordRechargePayout: ({ cycleStart, cycleEnd, status = 'recorded', notes = '' }) => {
    const orders = get().business.rechargeOrders || [];
    const commissions = get().business.rechargeCommissions || [];
    const expenses = get().business.businessExpenses || [];
    const payroll = get().business.staffPayroll || [];
    const cfg = get().getRechargeConfig();

    const from = new Date(cycleStart);
    const to = new Date(cycleEnd);
    to.setHours(23, 59, 59, 999);
    const inR = (v) => {
      if (!v) return false;
      const d = new Date(v);
      return !isNaN(d) && d >= from && d <= to;
    };

    // Benefits in cycle (only Terminé orders)
    let benefitsTotal = 0;
    orders.forEach((o) => {
      if (!String(o.status || '').toLowerCase().includes('termin')) return;
      if (!inR(o.date)) return;
      benefitsTotal += Number(o.profit) || 0;
    });

    // Commissions paid in cycle
    let commissionsPaid = 0;
    commissions.forEach((c) => {
      if (c.status !== 'paid') return;
      if (!inR(c.paidDate)) return;
      commissionsPaid += Number(c.commissionAmount) || 0;
    });

    // Recharge-tagged expenses in cycle (notes contain "recharge" case-insensitive)
    let expensesPaid = 0;
    expenses.forEach((e) => {
      if (!inR(e.date)) return;
      const tag = String(e.notes || '').toLowerCase() + ' ' + String(e.description || '').toLowerCase();
      if (!tag.includes('recharge')) return;
      const amtHtg = e.currency === 'USD' ? (Number(e.amount) || 0) * 150 : (Number(e.amount) || 0);
      expensesPaid += amtHtg;
    });

    // Recharge-tagged payroll in cycle
    let payrollPaid = 0;
    payroll.forEach((p) => {
      if (p.status !== 'paid') return;
      if (!inR(p.paidDate)) return;
      const tag = String(p.notes || '').toLowerCase();
      if (!tag.includes('recharge')) return;
      const amtHtg = p.currency === 'USD' ? (Number(p.amount) || 0) * 150 : (Number(p.amount) || 0);
      payrollPaid += amtHtg;
    });

    const netAfterCosts = benefitsTotal - commissionsPaid - expensesPaid - payrollPaid;
    const ceoSplitPct = Number(cfg.ceoSplitPct) || RECHARGE_CEO_SPLIT_PCT;
    const ceoAmount = Math.round(netAfterCosts * ceoSplitPct);
    const businessReserve = Math.round(netAfterCosts * (1 - ceoSplitPct));

    const payout = {
      id: uid('rpay'),
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      benefitsTotal: Math.round(benefitsTotal),
      commissionsPaid: Math.round(commissionsPaid),
      expensesPaid: Math.round(expensesPaid),
      payrollPaid: Math.round(payrollPaid),
      netAfterCosts: Math.round(netAfterCosts),
      ceoSplitPct,
      ceoAmount,
      businessReserve,
      currency: 'HTG',
      status,                          // 'proposed' | 'recorded' | 'skipped'
      recordedDate: status === 'recorded' ? nowISO() : '',
      notes,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      _pending: true,
    };

    set((s) => ({
      business: {
        ...s.business,
        rechargePayouts: [payout, ...s.business.rechargePayouts],
      },
    }));
    enqueueAvs(set, get, 'rechargePayout', 'create', stripMeta(payout));

    // Update lastPayoutDate if recorded
    if (status === 'recorded') {
      get().saveRechargeConfig({ lastPayoutDate: cycleEnd });
    }
    return payout;
  },

  updateRechargePayout: (id, patch) => {
    let updated = null;
    set((s) => ({
      business: {
        ...s.business,
        rechargePayouts: s.business.rechargePayouts.map((p) => {
          if (p.id !== id) return p;
          updated = { ...p, ...patch, updatedAt: nowISO(), _pending: true };
          return updated;
        }),
      },
    }));
    if (updated) enqueueAvs(set, get, 'rechargePayout', 'update', stripMeta(updated));
    return updated;
  },

  removeRechargePayout: (id) => {
    set((s) => ({
      business: {
        ...s.business,
        rechargePayouts: s.business.rechargePayouts.filter((p) => p.id !== id),
      },
    }));
    enqueueAvs(set, get, 'rechargePayout', 'delete', { id });
  },

  // ═══════════════════════════════════════════════════════════
  // HYDRATE — fetch everything from AVS server
  // ═══════════════════════════════════════════════════════════
  //
  // Called from useStore.js `hydrate()`. Follows the "merge, never
  // overwrite with empty" contract that fixed Round E's launch bug.
  //
  hydrateBusinessFromServer: async () => {
    try {
      const data = await avsApi.fetchAll();
      const local = get().business;

      // Translate French-tab data to English keys
      const translatedLeads          = fromFrenchAll('lead', data.leads || []);
      const translatedStaff          = fromFrenchAll('staff', data.staff || []);
      const translatedRechargeOrders = fromFrenchAll('rechargeOrder', data.rechargeOrders || []);

      set((s) => ({
        business: {
          ...s.business,
          leads:             mergeById(local.leads, translatedLeads),
          rechargeOrders:    mergeById(local.rechargeOrders, translatedRechargeOrders),
          staff:             mergeById(local.staff, translatedStaff),
          adSpend:           mergeById(local.adSpend, data.adSpend),
          staffCommissions:  mergeById(local.staffCommissions, data.staffCommissions),
          cardCosts:         mergeById(local.cardCosts, data.cardCosts),
          clients:           mergeById(local.clients, data.clients),
          fxRates:           mergeById(local.fxRates, data.fxRates),
          contentAdherence:  mergeById(local.contentAdherence, data.contentAdherence),
          staffPayroll:      mergeById(local.staffPayroll, data.staffPayroll),
          businessDebts:       mergeById(local.businessDebts, data.businessDebts),
          businessDebtEvents:  mergeById(local.businessDebtEvents, data.businessDebtEvents),
          businessExpenses:    mergeById(local.businessExpenses, data.businessExpenses),
          rechargeCommissions: mergeById(local.rechargeCommissions, data.rechargeCommissions),
          rechargePayouts:     mergeById(local.rechargePayouts, data.rechargePayouts),
          rechargeConfig:      Array.isArray(data.rechargeConfig) ? data.rechargeConfig : local.rechargeConfig,
          lastSyncAt:        nowISO(),
          syncError:         null,
        },
      }));

      // Recompute unified clients after fresh data arrives
      get().rebuildClientsUnified();

      // Auto-create Marc commissions for any new Terminé recharge orders
      // (make.com may have appended fresh rows since last hydrate). Idempotent.
      get().backfillRechargeCommissions();
    } catch (err) {
      // Same as Personal hydrate: NEVER overwrite local data on error.
      // Just log and let user retry. Local state remains intact.
      console.warn('[AVS hydrate]', err.message);
      set((s) => ({
        business: { ...s.business, syncError: err.message },
      }));
    }
  },

  // ═══════════════════════════════════════════════════════════
  // SYNC QUEUE — flushes pending ops to AVS server
  // ═══════════════════════════════════════════════════════════
  syncAvsQueue: async () => {
    const state = get().business;
    if (state.syncing) return;
    if (state.queue.length === 0) return;

    set((s) => ({ business: { ...s.business, syncing: true } }));

    const queue = state.queue.slice();
    try {
      await avsApi.bulk(queue);
      // Success: clear queue + mark _pending false everywhere
      set((s) => {
        const clearPending = (arr) =>
          arr.map((r) => (r._pending ? { ...r, _pending: false } : r));
        return {
          business: {
            ...s.business,
            queue: s.business.queue.slice(queue.length),  // drop what we sent
            leads:             clearPending(s.business.leads),
            adSpend:           clearPending(s.business.adSpend),
            staffCommissions:  clearPending(s.business.staffCommissions),
            cardCosts:         clearPending(s.business.cardCosts),
            staffPayroll:      clearPending(s.business.staffPayroll),
            contentAdherence:  clearPending(s.business.contentAdherence),
            businessDebts:       clearPending(s.business.businessDebts),
            businessDebtEvents:  clearPending(s.business.businessDebtEvents),
            businessExpenses:    clearPending(s.business.businessExpenses),
            rechargeCommissions: clearPending(s.business.rechargeCommissions),
            rechargePayouts:     clearPending(s.business.rechargePayouts),
            rechargeConfig:      clearPending(s.business.rechargeConfig),
            lastSyncAt:        nowISO(),
            syncError:         null,
            syncing:           false,
          },
        };
      });
    } catch (err) {
      // Verify-after-error: refetch and see what actually made it.
      // Any queue op whose ID is present on the server gets removed.
      try {
        const data = await avsApi.fetchAll();
        const serverIds = new Set();
        ['leads', 'adSpend', 'staffCommissions', 'cardCosts',
         'staffPayroll', 'contentAdherence', 'clients',
         'businessDebts', 'businessDebtEvents', 'businessExpenses',
         'rechargeCommissions', 'rechargePayouts', 'rechargeConfig'].forEach((coll) => {
          (data[coll] || []).forEach((r) => serverIds.add(r.id));
        });
        const survivors = queue.filter((op) => !serverIds.has(op.id));
        set((s) => ({
          business: {
            ...s.business,
            queue: [...survivors, ...s.business.queue.slice(queue.length)],
            syncError: err.message,
            syncing: false,
          },
        }));
      } catch (verifyErr) {
        // Verification also failed → keep queue intact for retry
        set((s) => ({
          business: {
            ...s.business,
            syncError: err.message,
            syncing: false,
          },
        }));
      }
    }
  },
});

// Periodic flush — start this once from useStore.js init
export function startAvsSyncLoop(getStore) {
  if (typeof window === 'undefined') return;
  // Don't start a second loop if one is already running
  if (window.__avsSyncLoop) return;
  window.__avsSyncLoop = setInterval(() => {
    const store = getStore();
    if (store.app?.workspace === 'avs' && store.business?.queue?.length > 0) {
      store.syncAvsQueue();
    }
  }, 20000);  // 20s, matches Personal's cadence
}
