"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useHousehold } from "@/components/providers/household-provider";
import { ScannedReceiptData } from "./add-expense-modal";

interface ScanReceiptButtonProps {
  onScanSuccess: (data: ScannedReceiptData) => void;
  className?: string;
}

export function ScanReceiptButton({ onScanSuccess, className = "" }: ScanReceiptButtonProps) {
  const { activeHousehold } = useHousehold();
  const [showPicker, setShowPicker] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the exact same file can be chosen again if needed
    e.target.value = "";
    setShowPicker(false);
    setIsAnalyzing(true);

    try {
      let base64String = "";
      let mimeType = file.type || "image/jpeg";

      if (file.type.startsWith("image/")) {
        // Compress image client-side to prevent Vercel 4.5MB payload limit errors
        base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              let { width, height } = img;
              const MAX_DIMENSION = 1200;
              
              if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                if (width > height) {
                  height = Math.round((height * MAX_DIMENSION) / width);
                  width = MAX_DIMENSION;
                } else {
                  width = Math.round((width * MAX_DIMENSION) / height);
                  height = MAX_DIMENSION;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              ctx?.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", 0.7));
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        mimeType = "image/jpeg"; // Since we converted to jpeg
      } else {
        // For PDF or other types, read directly
        base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const categories = activeHousehold?.metadata?.categories || [
        "Groceries",
        "Dining Out",
        "Utilities",
        "Rent",
        "Transportation",
        "Shopping",
        "Entertainment",
        "Health"
      ];
      const tags = activeHousehold?.metadata?.tags || [];

      const res = await fetch("/api/ai/analyze-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64String,
          mimeType,
          categories,
          tags,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to analyze image");
      }

      toast.success("✨ Receipt details extracted via Gemini AI!");
      onScanSuccess({
        ...json.data,
        file,
      });
      setIsAnalyzing(false);
    } catch (error: any) {
      console.error("AI Scan error:", error);
      toast.error(error.message || "Failed to scan receipt. Try manual entry.");
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setShowPicker(true)}
        variant="outline"
        className={`relative group border-purple-500/40 hover:border-purple-500 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-indigo-500/5 hover:from-purple-500/10 hover:via-pink-500/10 hover:to-indigo-500/10 transition-all text-purple-700 dark:text-purple-300 gap-2 font-medium shadow-sm ${className}`}
      >
        <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
        <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400 bg-clip-text text-transparent font-semibold">
          AI Scan Bill
        </span>
      </Button>

      {/* Hidden Inputs for Camera vs Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Choice Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className="bg-background rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-border relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
              <button
                onClick={() => setShowPicker(false)}
                className="text-muted-foreground hover:text-foreground rounded-full p-1 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 text-white shadow-md">
                <Sparkles className="h-5 w-5 animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 dark:from-purple-400 dark:via-pink-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Scan Receipt with AI
                </h3>
                <p className="text-xs text-muted-foreground">Auto-extract amount, date, description & category</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full justify-start gap-3 h-14 text-base rounded-xl border border-purple-500/20 hover:border-purple-500/50 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 text-foreground transition-all shadow-sm"
                variant="outline"
              >
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold block text-sm">Take Photo with Camera</span>
                  <span className="text-xs text-muted-foreground">Direct smartphone camera scan</span>
                </div>
              </Button>

              <Button
                onClick={() => galleryInputRef.current?.click()}
                className="w-full justify-start gap-3 h-14 text-base rounded-xl border border-pink-500/20 hover:border-pink-500/50 bg-gradient-to-r from-pink-500/10 to-purple-500/10 hover:from-pink-500/20 hover:to-purple-500/20 text-foreground transition-all shadow-sm"
                variant="outline"
              >
                <div className="p-2 bg-pink-500/10 text-pink-600 dark:text-pink-400 rounded-lg">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <span className="font-semibold block text-sm">Upload Image / Screenshot</span>
                  <span className="text-xs text-muted-foreground">From gallery, folder, or downloads</span>
                </div>
              </Button>
            </div>

            <p className="text-[11px] text-center text-muted-foreground mt-5">
              Powered by Google Gemini 2.5 Flash Multimodal Vision
            </p>
          </div>
        </div>
      )}

      {/* Analyzing Loader Dialog */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in-50">
          <div className="bg-background/90 rounded-2xl border border-purple-500/30 p-8 max-w-xs w-full text-center shadow-2xl flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 animate-spin flex items-center justify-center p-1 shadow-lg">
                <div className="w-full h-full bg-background rounded-full flex items-center justify-center">
                  <Sparkles className="h-7 w-7 text-purple-500 animate-pulse" />
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground mb-1">Analyzing Receipt...</h3>
              <p className="text-xs text-muted-foreground">
                Reading amount, date, vendor name, and categorizing with Gemini AI...
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
