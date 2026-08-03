"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useHousehold } from "@/components/providers/household-provider";
import { generateTelegramPairingCode, getTelegramStatus, unlinkTelegram } from "@/actions/telegram";
import { fetchAuthSession } from "aws-amplify/auth";
import { MessageSquare, CheckCircle2, Copy, ExternalLink, RefreshCw, Unplug, Info, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function TelegramSettings() {
  const { activeHousehold } = useHousehold();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLinked, setIsLinked] = useState(false);
  const [telegramUser, setTelegramUser] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState("HouseholdExpenseTrackerBot");
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!activeHousehold) return;
    setIsChecking(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const res = await getTelegramStatus(token, activeHousehold.householdId);
        setIsLinked(res.isLinked);
        setTelegramUser(res.telegramUsername);
        if (res.botUsername) setBotUsername(res.botUsername);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [activeHousehold]);

  const handleConnect = async () => {
    if (!activeHousehold) return;
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        const res = await generateTelegramPairingCode(token, activeHousehold.householdId);
        setPairingCode(res.code);
        if (res.botUsername) setBotUsername(res.botUsername);
        toast("Pairing code generated! Valid for 15 minutes.");
      }
    } catch (e) {
      console.error(e);
      toast("Failed to generate pairing code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!activeHousehold) return;
    setIsLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (token) {
        await unlinkTelegram(token, activeHousehold.householdId);
        setIsLinked(false);
        setTelegramUser(null);
        setPairingCode(null);
        toast("Telegram account unlinked successfully.");
      }
    } catch (e) {
      console.error(e);
      toast("Failed to unlink Telegram account.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      toast("Pairing code copied to clipboard!");
    }
  };

  if (!activeHousehold) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-sky-500 fill-sky-500/10" />
          Telegram Bot Integration
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Telegram account to interactively log expenses and check budgets via automated chat.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
        {isChecking ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" /> Checking Telegram status...
          </div>
        ) : isLinked ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    Connected to Telegram
                    <span className="text-xs bg-emerald-500/10 text-emerald-600 font-medium px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Linked User: <strong className="text-foreground">@{telegramUser || "Telegram User"}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                💡 How to use the bot:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Open Telegram and send <code className="bg-background px-1.5 py-0.5 rounded border text-foreground font-mono">hi</code> or <code className="bg-background px-1.5 py-0.5 rounded border text-foreground font-mono">/start</code> to <strong>@{botUsername}</strong>.</li>
                <li>Tap interactive options to record expenses, pick categories, add tags, and split costs.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleUnlink} 
                disabled={isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Unplug className="h-3.5 w-3.5 mr-1.5" />
                Disconnect Account
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500 flex-shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">No Telegram account connected</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Link your Telegram app to easily record daily expenses on the go using an interactive Question & Answer assistant without opening the browser!
                </p>
              </div>
            </div>

            {!pairingCode ? (
              <Button 
                onClick={handleConnect} 
                disabled={isLoading}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-all flex items-center justify-center gap-2 py-5"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 fill-white" />
                    Generate Telegram Pairing Link
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            ) : (
              <div className="rounded-xl border bg-muted/30 p-4 space-y-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b pb-3">
                  <span className="text-xs font-medium text-muted-foreground">Temporary Pairing Code</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold tracking-widest bg-background border px-3 py-1 rounded text-base">
                      {pairingCode}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyCode} title="Copy code">
                      <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-foreground">Next steps (complete within 15 minutes):</p>
                  
                  <ol className="text-xs text-muted-foreground space-y-2.5 list-decimal list-inside">
                    <li>
                      Tap the button below to open our Telegram Bot directly:
                      <div className="mt-2">
                        <a
                          href={`https://t.me/${botUsername}?start=CONNECT-${pairingCode}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white px-4 py-2.5 font-medium text-xs shadow-sm w-full transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open @{botUsername} in Telegram & Connect
                        </a>
                      </div>
                    </li>
                    <li>
                      Press <strong>Start</strong> at the bottom of the Telegram chat window (or type <code className="font-mono bg-background border px-1 py-0.5 rounded text-foreground">/link {pairingCode}</code>).
                    </li>
                    <li>
                      Once linked, return here and tap <button onClick={checkStatus} className="text-primary underline hover:text-primary/80 font-medium">refresh status</button>.
                    </li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-border/50" />

      {/* Multi-Member Explanation Section */}
      <div className="rounded-xl border bg-card/60 p-4 sm:p-5 space-y-3">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Users className="h-4 w-4 text-primary" />
          How to invite family members & partners
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each household member can link their personal Telegram account independently! Simply share these instructions with your partner or roommates:
        </p>
        <div className="bg-muted/40 border rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-medium text-foreground">Steps for other household members:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Log into this Expense Tracker app on their own phone/computer.</li>
            <li>Go to <strong>Settings → Manage Household → Telegram</strong> (this screen).</li>
            <li>Click <strong>Generate Telegram Pairing Link</strong> under their own profile.</li>
          </ol>
          <p className="text-[11px] text-primary/90 pt-1 border-t mt-2">
            ✨ When your partner messages the bot, expenses will automatically be recorded under their individual name inside this same household!
          </p>
        </div>
      </div>
    </div>
  );
}
