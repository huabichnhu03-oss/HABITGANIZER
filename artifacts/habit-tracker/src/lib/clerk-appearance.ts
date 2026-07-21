import { neobrutalism } from "@clerk/themes";

/** Matches HABIGANIZE neo-brutalist shell; shared by ClerkProvider + hosted Clerk UI surfaces. */
export function createClerkAppearance(basePath: string) {
  const root = basePath.replace(/\/$/, "");
  return {
    baseTheme: neobrutalism,
    cssLayerName: "clerk",
    options: {
      logoPlacement: "inside" as const,
      logoLinkUrl: root || "/",
      logoImageUrl: `${typeof window !== "undefined" ? window.location.origin : ""}${root}/logo.svg`,
    },
    variables: {
      colorPrimary: "#e85d8f",
      colorForeground: "#3a2f26",
      colorMutedForeground: "#6b5e54",
      colorDanger: "#c75038",
      colorBackground: "#faf6f0",
      colorInput: "#ffffff",
      colorInputForeground: "#3a2f26",
      colorNeutral: "#3a2f26",
      fontFamily: "Outfit, sans-serif",
      borderRadius: "0.75rem",
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border-4 border-[#3a2f26] shadow-[6px_6px_0_#3a2f26]",
      card: "!shadow-none !border-0 !bg-transparent !rounded-none",
      footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
      headerTitle: "font-black text-[#3a2f26]",
      headerSubtitle: "text-[#6b5e54]",
      socialButtonsBlockButtonText: "text-[#3a2f26] font-bold",
      formFieldLabel: "text-[#3a2f26] font-black uppercase text-xs tracking-wider",
      footerActionLink: "text-[#e85d8f] font-bold",
      footerActionText: "text-[#6b5e54]",
      dividerText: "text-[#6b5e54]",
      identityPreviewEditButton: "text-[#e85d8f]",
      formFieldSuccessText: "text-green-600",
      alertText: "text-[#3a2f26]",
      logoBox: "flex justify-center",
      logoImage: "w-12 h-12",
      socialButtonsBlockButton: "border-2 border-[#3a2f26] font-bold",
      formButtonPrimary: "uppercase font-black tracking-wide",
      formFieldInput: "border-2 border-[#3a2f26] rounded-xl",
      footerAction: "bg-[#faf6f0]",
      dividerLine: "bg-[#3a2f26]",
      alert: "border-2",
      otpCodeFieldInput: "border-2 border-[#3a2f26] rounded-xl",
      formFieldRow: "",
      main: "",
    },
  };
}
