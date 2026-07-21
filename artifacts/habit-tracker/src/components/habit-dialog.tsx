import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateHabit, useUpdateHabit, getListHabitsQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { HABIT_ICONS, DynamicIcon, HABIT_BRUTAL_COLORS, normalizeHex, getReadableForeground } from "@/components/icons";
import { Pipette } from "lucide-react";

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(200).optional(),
  color: z.string().regex(HEX_REGEX, "Pick a valid hex color").default(HABIT_BRUTAL_COLORS[0].hex),
  icon: z.string().min(1),
  targetDays: z.array(z.string()).min(1, "Select at least one day"),
  reminderEnabled: z.boolean().default(false),
  reminderTimes: z.array(z.string().regex(TIME_REGEX, "Use HH:MM (24h)")).default([]),
});

type FormValues = z.infer<typeof formSchema>;

const DAYS = [
  { value: "all", label: "Everyday" },
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

export function HabitDialog({ open, onOpenChange, editingHabit }: { open: boolean, onOpenChange: (open: boolean) => void, editingHabit?: any }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  // Whether the "Other" custom-color UI is active. Sticky during editing so
  // an intermediate invalid hex value doesn't collapse the input row.
  const [showHexInput, setShowHexInput] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      color: HABIT_BRUTAL_COLORS[0].hex,
      icon: HABIT_ICONS[0],
      targetDays: ["all"],
      reminderEnabled: false,
      reminderTimes: [],
    },
  });

  useEffect(() => {
    if (open) {
      if (editingHabit) {
        const stored = normalizeHex(editingHabit.color);
        const initialColor = stored ?? HABIT_BRUTAL_COLORS[0].hex;
        const isCustomInitial =
          !!stored &&
          !HABIT_BRUTAL_COLORS.some(
            c => c.hex.toLowerCase() === stored.toLowerCase(),
          );
        setShowHexInput(isCustomInitial);
        form.reset({
          name: editingHabit.name,
          description: editingHabit.description || "",
          color: initialColor,
          icon: editingHabit.icon,
          targetDays: editingHabit.targetDays,
          reminderEnabled: !!editingHabit.reminderEnabled,
          reminderTimes: Array.isArray(editingHabit.reminderTimes) ? editingHabit.reminderTimes : [],
        });
      } else {
        setShowHexInput(false);
        form.reset({
          name: "",
          description: "",
          color: HABIT_BRUTAL_COLORS[0].hex,
          icon: HABIT_ICONS[0],
          targetDays: ["all"],
          reminderEnabled: false,
          reminderTimes: [],
        });
      }
    }
  }, [open, editingHabit, form]);

  const onSubmit = (rawValues: FormValues) => {
    const values: FormValues = {
      ...rawValues,
      color: normalizeHex(rawValues.color) ?? rawValues.color,
    };
    if (values.reminderEnabled && values.reminderTimes.length > 0 && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    if (editingHabit) {
      updateHabit.mutate({ id: editingHabit.id, data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: "Habit updated", description: "Your habit has been saved." });
          onOpenChange(false);
        }
      });
    } else {
      createHabit.mutate({ data: values }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: "Habit created", description: "Your new habit is ready." });
          onOpenChange(false);
        }
      });
    }
  };

  const isPending = createHabit.isPending || updateHabit.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto rounded-[2rem] p-8 border-brutal shadow-brutal bg-white">
        <DialogHeader>
          <DialogTitle className="text-4xl font-black uppercase tracking-tighter">
            {editingHabit ? "Edit Habit" : "New Habit"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xl font-black uppercase tracking-tight">Habit Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="E.G. READ 20 PAGES" 
                      className="h-16 text-xl font-bold rounded-2xl border-brutal shadow-brutal-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-brutal bg-background" 
                      {...field} 
                      data-testid="input-habit-name" 
                    />
                  </FormControl>
                  <FormMessage className="font-bold" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xl font-black uppercase tracking-tight">Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Why is this important?" 
                      className="min-h-[100px] text-lg font-bold rounded-2xl border-brutal shadow-brutal-sm resize-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:shadow-brutal bg-background" 
                      {...field} 
                      data-testid="input-habit-description" 
                    />
                  </FormControl>
                  <FormMessage className="font-bold" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => {
                const normalizedValue = normalizeHex(field.value);
                const valueIsSwatch =
                  !!normalizedValue &&
                  HABIT_BRUTAL_COLORS.some(
                    s => s.hex.toLowerCase() === normalizedValue.toLowerCase(),
                  );
                const customActive = showHexInput || (!!normalizedValue && !valueIsSwatch);
                const previewHex = normalizedValue ?? "#4258d6";
                return (
                  <FormItem>
                    <FormLabel className="text-xl font-black uppercase tracking-tight">Color</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-3" data-testid="color-swatches">
                          {HABIT_BRUTAL_COLORS.map(swatch => {
                            const isSelected =
                              !customActive &&
                              field.value?.toLowerCase() === swatch.hex.toLowerCase();
                            return (
                              <button
                                key={swatch.hex}
                                type="button"
                                onClick={() => {
                                  setShowHexInput(false);
                                  field.onChange(swatch.hex);
                                }}
                                aria-label={swatch.name}
                                data-testid={`swatch-${swatch.name.toLowerCase()}`}
                                className={`w-12 h-12 rounded-xl transition-all ${swatch.tailwind} ${
                                  isSelected
                                    ? "border-brutal shadow-brutal-sm scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                                    : "border-brutal-sm hover:scale-105"
                                }`}
                              />
                            );
                          })}
                          <label
                            data-testid="swatch-other"
                            aria-label="Other color"
                            onClick={() => setShowHexInput(true)}
                            className={`relative w-12 h-12 rounded-xl transition-all cursor-pointer flex items-center justify-center overflow-hidden ${
                              customActive
                                ? "border-brutal shadow-brutal-sm scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background"
                                : "border-brutal-sm hover:scale-105"
                            }`}
                            style={{
                              background: customActive && normalizedValue
                                ? normalizedValue
                                : "conic-gradient(from 0deg, #ff4d4d, #ffd23f, #7fc66c, #4258d6, #b14dff, #ff4d4d)",
                            }}
                          >
                            <Pipette
                              className="w-5 h-5"
                              strokeWidth={3}
                              color={
                                customActive && normalizedValue
                                  ? getReadableForeground(normalizedValue)
                                  : "#141414"
                              }
                            />
                            <input
                              type="color"
                              value={previewHex}
                              onChange={(e) => {
                                setShowHexInput(true);
                                field.onChange((e.target.value || "").toLowerCase());
                              }}
                              data-testid="input-color-picker"
                              aria-label="Pick custom color"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                          </label>
                        </div>
                        {customActive && (
                          <div className="flex items-center gap-3" data-testid="custom-color-row">
                            <div
                              className="w-10 h-10 rounded-lg border-brutal-sm shadow-brutal-sm flex-shrink-0"
                              style={{ backgroundColor: normalizedValue ?? "#cccccc" }}
                              aria-hidden
                            />
                            <Input
                              value={field.value}
                              onChange={(e) => {
                                setShowHexInput(true);
                                field.onChange(e.target.value);
                              }}
                              placeholder="#aabbcc"
                              maxLength={7}
                              spellCheck={false}
                              data-testid="input-color-hex"
                              className="h-12 max-w-[160px] text-base font-bold rounded-xl border-brutal-sm shadow-brutal-sm bg-background uppercase tracking-wider focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                            <span className="text-sm font-bold opacity-70">
                              Type a hex like #ff8800
                            </span>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage className="font-bold" />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xl font-black uppercase tracking-tight">Icon</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-5 sm:grid-cols-7 gap-3">
                      {HABIT_ICONS.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => field.onChange(icon)}
                          className={`aspect-square rounded-2xl flex items-center justify-center transition-all border-2 ${field.value === icon ? 'bg-primary text-white border-brutal shadow-brutal-sm scale-110 z-10' : 'bg-background border-border hover:bg-muted'}`}
                        >
                          <DynamicIcon name={icon} className="w-8 h-8" strokeWidth={field.value === icon ? 3 : 2} />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage className="font-bold" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xl font-black uppercase tracking-tight">Frequency</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-3">
                      {DAYS.map(day => {
                        const isSelected = field.value.includes(day.value);
                        const isAll = field.value.includes("all");
                        const isActive = isSelected || (isAll && day.value !== "all");
                        
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              if (day.value === "all") {
                                field.onChange(["all"]);
                              } else {
                                let newDays = field.value.filter(d => d !== "all");
                                if (newDays.includes(day.value)) {
                                  newDays = newDays.filter(d => d !== day.value);
                                } else {
                                  newDays.push(day.value);
                                }
                                if (newDays.length === 7) newDays = ["all"];
                                field.onChange(newDays);
                              }
                            }}
                            className={`px-5 py-3 rounded-xl text-lg font-black uppercase tracking-wider transition-all border-brutal-sm ${isActive ? 'bg-foreground text-white shadow-brutal-sm' : 'bg-background text-foreground hover:bg-muted'}`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage className="font-bold" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminderEnabled"
              render={({ field: enabledField }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xl font-black uppercase tracking-tight">Reminders</FormLabel>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabledField.value}
                      data-testid="toggle-reminder-enabled"
                      onClick={() => {
                        const next = !enabledField.value;
                        enabledField.onChange(next);
                        if (next) {
                          const current = form.getValues("reminderTimes") ?? [];
                          if (current.length === 0) form.setValue("reminderTimes", ["08:00"], { shouldDirty: true });
                        }
                      }}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full border-brutal-sm transition-all ${enabledField.value ? "bg-foreground" : "bg-background"}`}
                    >
                      <span
                        className={`inline-block h-6 w-6 rounded-full border-brutal-sm transition-transform ${enabledField.value ? "translate-x-7 bg-accent" : "translate-x-1 bg-muted"}`}
                      />
                    </button>
                  </div>
                  {enabledField.value ? (
                    <FormField
                      control={form.control}
                      name="reminderTimes"
                      render={({ field: timesField }) => {
                        const times: string[] = timesField.value ?? [];
                        const updateAt = (idx: number, val: string) => {
                          const next = [...times];
                          next[idx] = val;
                          timesField.onChange(next);
                        };
                        const removeAt = (idx: number) => {
                          const next = times.filter((_, i) => i !== idx);
                          timesField.onChange(next);
                          if (next.length === 0) form.setValue("reminderEnabled", false, { shouldDirty: true });
                        };
                        const add = () => timesField.onChange([...times, "08:00"]);
                        return (
                          <div className="mt-3 space-y-3" data-testid="reminder-times">
                            {times.length === 0 ? (
                              <p className="text-sm font-bold opacity-70">No reminder times yet. Add one below.</p>
                            ) : (
                              times.map((t, idx) => (
                                <div key={idx} className="flex items-center gap-3" data-testid={`reminder-time-row-${idx}`}>
                                  <Input
                                    type="time"
                                    value={t}
                                    onChange={(e) => updateAt(idx, e.target.value)}
                                    className="h-12 w-40 text-lg font-bold rounded-xl border-brutal-sm shadow-brutal-sm bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                                    data-testid={`reminder-time-input-${idx}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeAt(idx)}
                                    aria-label={`Remove reminder ${t}`}
                                    data-testid={`reminder-time-remove-${idx}`}
                                    className="brutal-btn bg-background text-foreground px-4 py-2 text-sm"
                                  >
                                    REMOVE
                                  </button>
                                </div>
                              ))
                            )}
                            <button
                              type="button"
                              onClick={add}
                              data-testid="reminder-time-add"
                              className="brutal-btn bg-foreground text-white px-5 py-3 text-sm"
                            >
                              + ADD TIME
                            </button>
                            <p className="text-xs font-bold opacity-60">
                              Reminders fire on the days this habit is scheduled, in your device's local time.
                            </p>
                            <FormMessage className="font-bold" />
                          </div>
                        );
                      }}
                    />
                  ) : (
                    <p className="text-sm font-bold opacity-70 mt-2">
                      Off. Turn on to get nudged at chosen times on scheduled days.
                    </p>
                  )}
                </FormItem>
              )}
            />

            <DialogFooter className="mt-10 gap-4 sm:gap-0">
              <button 
                type="button" 
                onClick={() => onOpenChange(false)} 
                className="brutal-btn bg-background text-foreground px-6 py-4 text-xl w-full sm:w-auto" 
                disabled={isPending}
              >
                CANCEL
              </button>
              <button 
                type="submit" 
                className="brutal-btn bg-accent text-foreground px-8 py-4 text-xl w-full sm:w-auto hover:bg-accent/90" 
                disabled={isPending} 
                data-testid="button-save-habit"
              >
                {isPending ? "SAVING..." : "SAVE HABIT"}
              </button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
