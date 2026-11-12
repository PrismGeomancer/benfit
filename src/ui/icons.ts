// Line icons in the logo's language: thick hi-vis strokes on Baltic, round caps.
const wrap = (body: string) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g fill="none" stroke="#F2E600" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

export const icons = {
  // A coin dropping into a payslip slot (step 1: launch)
  launch: wrap('<circle class="i-coin" cx="32" cy="18" r="9"/><path d="M14 32h36"/><path d="M18 32v22h28V32"/><path d="M24 42h12M24 48h8"/>'),
  // A wallet with a coin (step 2: hold)
  hold: wrap('<rect x="10" y="20" width="44" height="30" rx="5"/><path d="M10 28h44"/><path d="M42 39h6"/><circle class="i-coin" cx="24" cy="14" r="6"/>'),
  // A calendar with the Friday column filled (step 3: payday)
  payday: wrap('<rect x="10" y="14" width="44" height="40" rx="4"/><path d="M10 24h44M22 10v8M42 10v8"/><path class="i-fri" d="M40 30v18" stroke-width="7"/><path d="M18 32h4M18 40h4M28 32h4M28 40h4"/>'),
  // A stopwatch reset to the top (step 4: sell resets)
  reset: wrap('<circle cx="32" cy="36" r="18"/><path class="i-hand" d="M32 36V22"/><path d="M28 10h8M46 20l3-3"/>'),
  ledger: wrap('<path d="M14 10h30l6 6v38H14z"/><path d="M22 24h20M22 32h20M22 40h12"/>'),
  shield: wrap('<path d="M32 8l20 8v14c0 13-9 22-20 26-11-4-20-13-20-26V16z"/><path d="M24 32l6 6 11-12"/>'),
};
