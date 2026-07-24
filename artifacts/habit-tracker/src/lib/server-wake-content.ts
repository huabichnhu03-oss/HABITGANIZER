/** Status lines shown under the running pup while Render wakes. */
export const SERVER_WAKE_STATUS_LINES = [
  "Your list is on the way…",
  "Something is on the way…",
  "Waking the server…",
  "Habits are stretching…",
  "Almost there…",
  "Fetching your day…",
] as const;

/** Fun facts / tiny prompts to read during cold start (30–60s on free Render). */
export const SERVER_WAKE_FUN_FACTS = [
  "Dogs can learn over 100 words. Your habits can too, one check-in at a time.",
  "It takes about 66 days on average for a new habit to feel automatic.",
  "A 2-minute version of a habit beats skipping the whole thing.",
  "Shibas are famously stubborn. Consistency > motivation.",
  "Your brain loves streaks: small wins release a little dopamine.",
  "Walking a dog lowers stress hormones. Same idea as a short habit break.",
  "Missed a day? Pick up tomorrow. Identity is built by returning, not perfection.",
  "Pixel pups run on snacks and patience. Servers do too.",
  "Habit stacking: after I pour coffee, I open Habiganize.",
  "Corgis have short legs and big hearts. Short habits, big results.",
  "Writing down a goal makes you more likely to follow through.",
  "Sleep is a habit multiplier. Tired brains quit early.",
  "One good habit can make other habits easier (keystone habits).",
  "Dalmatians are born spotless. Habits start blank too, then they fill in.",
  "If it feels hard, shrink it until it feels silly-easy.",
  "Accountability buddies raise completion rates. Say hi to a friend later.",
  "Cold showers are optional. Cold starts are not. Thanks for waiting!",
  "Your future self is cheering for the tiny version of this habit.",
  "Otters hold hands so they don’t drift. Habits hold your day together.",
  "Progress compounds: 1% better daily adds up faster than it feels.",
] as const;

export function pickRandomIndex(length: number, exclude?: number): number {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  if (exclude !== undefined && length > 1) {
    let guard = 0;
    while (next === exclude && guard++ < 8) {
      next = Math.floor(Math.random() * length);
    }
  }
  return next;
}
