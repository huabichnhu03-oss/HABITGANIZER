import React, { useCallback, useState } from "react";
import {
  useListHabits,
  useDeleteHabit,
  useArchiveHabit,
  useUnarchiveHabit,
  getListHabitsQueryKey,
  getGetDashboardQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DynamicIcon, getHabitColor, getReadableForeground } from "@/components/icons";
import { Plus, Edit2, Trash2, Flame, Archive, ArchiveRestore } from "lucide-react";
import { HabitDialog } from "@/components/habit-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";

type Tab = "active" | "archived";

export function HabitsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("active");
  const activeQuery = useListHabits({ archived: false });
  const archivedQuery = useListHabits({ archived: true });
  const habits = tab === "active" ? activeQuery.data : archivedQuery.data;
  const archivedCount = archivedQuery.data?.length ?? 0;

  const deleteHabit = useDeleteHabit();
  const archiveHabit = useArchiveHabit();
  const unarchiveHabit = useUnarchiveHabit();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<any>(null);

  const invalidateLists = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey({ archived: false }) });
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey({ archived: true }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient]);

  const handleDelete = useCallback((id: number) => {
    deleteHabit.mutate({ id }, {
      onSuccess: () => {
        invalidateLists();
        toast({ title: "Habit deleted", description: "The habit and its history are gone for good." });
      }
    });
  }, [deleteHabit, invalidateLists, toast]);

  const handleArchive = useCallback((id: number, name: string) => {
    archiveHabit.mutate({ id }, {
      onSuccess: () => {
        invalidateLists();
        toast({ title: "Habit archived", description: `"${name}" is hidden from active lists. History is kept.` });
      }
    });
  }, [archiveHabit, invalidateLists, toast]);

  const handleUnarchive = useCallback((id: number, name: string) => {
    unarchiveHabit.mutate({ id }, {
      onSuccess: () => {
        invalidateLists();
        toast({ title: "Habit restored", description: `"${name}" is back in your active list.` });
      }
    });
  }, [unarchiveHabit, invalidateLists, toast]);

  const openEdit = useCallback((habit: any) => {
    setEditingHabit(habit);
    setDialogOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditingHabit(null);
    setDialogOpen(true);
  }, []);

  if (activeQuery.isError || archivedQuery.isError) {
    return (
      <div className="space-y-8">
        <ApiQueryErrorBanner
          title="Couldn’t load habits"
          onRetry={() => {
            void activeQuery.refetch();
            void archivedQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!activeQuery.data && !archivedQuery.data) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div className="h-12 w-48 bg-muted rounded-xl animate-pulse" />
          <div className="h-14 w-40 bg-muted rounded-xl animate-pulse" />
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-muted rounded-[2rem] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-foreground">All Habits</h1>
          <p className="text-sm sm:text-xl font-bold mt-1 text-foreground/80">Configure your daily routines.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-accent text-foreground px-4 sm:px-6 py-3 sm:py-4 brutal-btn flex items-center justify-center text-base sm:text-lg hover:bg-accent/90 w-full sm:w-auto"
          data-testid="button-create-habit"
        >
          <Plus className="w-5 h-5 sm:w-6 sm:h-6 mr-2" strokeWidth={3} />
          NEW HABIT
        </button>
      </header>

      <div className="flex gap-2 sm:gap-3" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "active"}
          onClick={() => setTab("active")}
          data-testid="tab-active"
          className={`brutal-btn px-3 sm:px-5 py-2 sm:py-3 text-sm sm:text-base font-black uppercase tracking-tight ${tab === "active" ? "bg-foreground text-white" : "bg-white text-foreground"}`}
        >
          Active
        </button>
        <button
          role="tab"
          aria-selected={tab === "archived"}
          onClick={() => setTab("archived")}
          data-testid="tab-archived"
          className={`brutal-btn px-3 sm:px-5 py-2 sm:py-3 text-sm sm:text-base font-black uppercase tracking-tight flex items-center gap-1.5 sm:gap-2 ${tab === "archived" ? "bg-foreground text-white" : "bg-white text-foreground"}`}
        >
          <Archive className="w-4 h-4" strokeWidth={3} />
          Archived
          {archivedCount > 0 && (
            <span className={`px-2 py-0.5 rounded-md border-brutal-sm text-sm ${tab === "archived" ? "bg-accent text-foreground" : "bg-foreground text-white"}`}>
              {archivedCount}
            </span>
          )}
        </button>
      </div>

      {(!habits || habits.length === 0) ? (
        tab === "active" ? (
          <div className="text-center p-12 bg-white rounded-3xl border-brutal shadow-brutal">
            <div className="w-24 h-24 bg-accent border-brutal shadow-brutal rounded-full flex items-center justify-center mx-auto mb-6 -rotate-6">
              <Plus className="w-12 h-12 text-foreground" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">No habits yet</h2>
            <p className="text-xl font-bold mb-8">Create your first habit to start building your routine.</p>
            <button onClick={openCreate} className="bg-primary text-white brutal-btn px-8 py-4 text-xl">CREATE HABIT</button>
          </div>
        ) : (
          <div className="text-center p-12 bg-white rounded-3xl border-brutal shadow-brutal">
            <div className="w-24 h-24 bg-secondary border-brutal shadow-brutal rounded-full flex items-center justify-center mx-auto mb-6 -rotate-6">
              <Archive className="w-12 h-12 text-foreground" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">No archived habits</h2>
            <p className="text-xl font-bold">Archived habits will appear here. Their history is always preserved.</p>
          </div>
        )
      ) : (
        <div className="grid gap-6">
          {habits.map((habit, index) => {
            const colorDef = getHabitColor(habit, index);
            const isArchived = tab === "archived";
            const fg = getReadableForeground(colorDef.hex);

            return (
              <div key={habit.id} className={`brutal-card p-3 sm:p-6 flex flex-col group overflow-hidden max-w-full ${colorDef.tailwind} ${isArchived ? "opacity-90" : ""}`} style={{ backgroundColor: colorDef.hex, color: fg }}>
                <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
                  <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                    <div className="shrink-0 w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.25rem] flex items-center justify-center bg-white border-brutal-sm shadow-brutal-sm text-foreground">
                      <DynamicIcon name={habit.icon} className="w-5 h-5 sm:w-8 sm:h-8" strokeWidth={3} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-base sm:text-2xl uppercase tracking-tight truncate" style={{ color: fg }}>{habit.name}</h3>
                        {isArchived && (
                          <span className="bg-foreground text-white px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase border-brutal-sm shadow-brutal-sm">Archived</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                        <div className="flex gap-1 sm:gap-1.5 flex-wrap">
                          {["sun","mon","tue","wed","thu","fri","sat"].map(day => {
                            const isActive = habit.targetDays.includes("all") || habit.targetDays.includes(day);
                            return (
                              <div key={day} className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-black uppercase border-brutal-sm ${isActive ? "bg-foreground text-white shadow-brutal-sm" : "bg-white text-foreground"}`}>
                                {day.charAt(0)}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {!isArchived && (
                      <>
                        <button className="bg-white p-2 sm:p-3 rounded-lg sm:rounded-xl border-brutal-sm shadow-brutal-sm hover:bg-muted active:translate-y-1 active:shadow-none transition-all" onClick={() => openEdit(habit)} data-testid={`button-edit-${habit.id}`} aria-label={`Edit ${habit.name}`}>
                          <Edit2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-foreground" strokeWidth={3} />
                        </button>
                        <button
                          className="bg-secondary text-foreground p-2 sm:p-3 rounded-lg sm:rounded-xl border-brutal-sm shadow-brutal-sm hover:bg-secondary/80 active:translate-y-1 active:shadow-none transition-all"
                          onClick={() => handleArchive(habit.id, habit.name)}
                          data-testid={`button-archive-${habit.id}`}
                          aria-label={`Archive ${habit.name}`}
                        >
                          <Archive className="w-3.5 h-3.5 sm:w-5 sm:h-5" strokeWidth={3} />
                        </button>
                      </>
                    )}
                    {isArchived && (
                      <button
                        className="bg-accent text-foreground p-2 sm:p-3 rounded-lg sm:rounded-xl border-brutal-sm shadow-brutal-sm hover:bg-accent/80 active:translate-y-1 active:shadow-none transition-all flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4"
                        onClick={() => handleUnarchive(habit.id, habit.name)}
                        data-testid={`button-unarchive-${habit.id}`}
                        aria-label={`Unarchive ${habit.name}`}
                      >
                        <ArchiveRestore className="w-3.5 h-3.5 sm:w-5 sm:h-5" strokeWidth={3} />
                        <span className="hidden sm:inline font-black uppercase tracking-tight text-sm">Unarchive</span>
                      </button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="bg-destructive text-white p-2 sm:p-3 rounded-lg sm:rounded-xl border-brutal-sm shadow-brutal-sm hover:bg-destructive/90 active:translate-y-1 active:shadow-none transition-all" data-testid={`button-delete-${habit.id}`} aria-label={`Delete ${habit.name}`}>
                          <Trash2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" strokeWidth={3} />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-brutal shadow-brutal">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black uppercase">Delete habit forever?</AlertDialogTitle>
                          <AlertDialogDescription className="text-lg font-bold text-foreground/80">
                            This permanently deletes "{habit.name}" and every completion in its history. This cannot be undone. If you just want to hide it from your active list, archive it instead.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6 gap-3 sm:gap-0">
                          <AlertDialogCancel className="brutal-btn bg-white text-foreground hover:bg-muted border-brutal h-12 text-lg">CANCEL</AlertDialogCancel>
                          <AlertDialogAction className="brutal-btn bg-destructive text-white hover:bg-destructive/90 h-12 text-lg" onClick={() => handleDelete(habit.id)}>
                            DELETE FOREVER
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {habit.description && <p className="text-sm sm:text-lg font-bold mb-3 sm:mb-6 bg-white/70 p-3 sm:p-4 rounded-xl border-brutal-sm text-foreground">{habit.description}</p>}

                <div className="mt-auto pt-3 sm:pt-4 border-t-[3px] border-border flex flex-wrap gap-2 justify-between text-sm sm:text-lg font-bold text-foreground">
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border-brutal-sm shadow-brutal-sm">
                    <Flame className="w-4 h-4 sm:w-6 sm:h-6 fill-orange-500 text-orange-500" />
                    <span>STREAK: <strong className="font-black text-base sm:text-xl">{habit.currentStreak}</strong></span>
                  </div>
                  <div className="flex items-center bg-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border-brutal-sm shadow-brutal-sm">
                    <span>BEST: <strong className="font-black text-base sm:text-xl">{habit.longestStreak}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <HabitDialog open={dialogOpen} onOpenChange={setDialogOpen} editingHabit={editingHabit} />
    </div>
  );
}
