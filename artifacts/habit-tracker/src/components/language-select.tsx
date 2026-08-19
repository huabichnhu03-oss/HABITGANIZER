import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALES, useTranslation, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

type LanguageSelectProps = {
  className?: string;
  id?: string;
  showLabel?: boolean;
};

export function LanguageSelect({ className, id = "language-select", showLabel = true }: LanguageSelectProps) {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel ? (
        <label htmlFor={id} className="block text-xs font-black tracking-wide text-foreground">
          {t("language.choosePrompt")}
        </label>
      ) : (
        <span className="sr-only" id={`${id}-label`}>
          {t("language.choosePrompt")}
        </span>
      )}
      <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
        <SelectTrigger
          id={id}
          data-testid="language-select"
          className="h-12 w-full rounded-xl border-2 border-foreground bg-white px-4 font-bold shadow-[3px_3px_0_hsl(var(--foreground))]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-2 border-foreground">
          {LOCALES.map((item) => (
            <SelectItem
              key={item.code}
              value={item.code}
              data-testid={`language-option-${item.code}`}
              className="font-bold"
            >
              {item.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
