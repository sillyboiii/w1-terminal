export interface CommandSpec {
  code: string;
  title: string;
  description: string;
  key?: string;
}

export const COMMAND_SPECS: CommandSpec[] = [
  { code: "GP", title: "Go Portfolio", description: "Open the W1 holdings and NAV snapshot", key: "F4" },
  { code: "WEI", title: "Watchlist", description: "Open the live market watchlist", key: "F3" },
  { code: "NEWS", title: "News", description: "Live market headlines", key: "F2" },
  { code: "WIRE", title: "W1 Wire", description: "Published W1 research wire", key: "F5" },
  { code: "ANALYST", title: "Analyst Desk", description: "Company financials and W1 analyst research", key: "F9" },
  { code: "HP", title: "Holdings", description: "Open the holdings grid", key: "F4" },
  { code: "DESK", title: "Desk", description: "Reset the default three-pane desk", key: "F8" },
  { code: "MAX", title: "Maximise", description: "Toggle full-screen on a pane", key: "F7" },
  { code: "HELP", title: "Help", description: "Show the command reference", key: "F6" },
  { code: "<TICKER>", title: "Quote", description: "Type any ticker then <GO> to open its chart", key: "F1" },
];

export const FUNCTION_KEYS: Record<string, string> = {
  F1: "AAPL <GO>",
  F2: "NEWS <GO>",
  F3: "WEI <GO>",
  F4: "HP <GO>",
  F5: "WIRE <GO>",
  F6: "HELP <GO>",
  F7: "MAX <GO>",
  F8: "DESK <GO>",
  F9: "ANALYST <GO>",
};
