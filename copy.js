/* ===== Nudge · copy.js =====
   All the friendly words live here, so the app sounds like one person
   and you can change the voice in one place. */
window.Nudge = window.Nudge || {};

Nudge.copy = (function () {
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function greeting(name) {
    const h = new Date().getHours();
    const who = name ? ", " + name : "";
    if (h < 5)  return "Still up" + who + "? Let's keep it short tonight.";
    if (h < 12) return "Good morning" + who + ".";
    if (h < 17) return "Good afternoon" + who + ".";
    if (h < 21) return "Good evening" + who + ".";
    return "Winding down" + who + "? One last look at tomorrow.";
  }

  /* Encouragement based on how much of today's list is done (0 to 1) */
  function progress(ratio) {
    if (ratio >= 1)   return pick(["That's everything. Go enjoy the rest of your day.", "All done. You earned a proper break."]);
    if (ratio >= 0.5) return pick(["More than halfway. Keep going.", "Good momentum. Just a little left."]);
    if (ratio > 0)    return pick(["Nice start. One at a time.", "That's one down. The rest get easier."]);
    return pick(["Tick something off and watch what happens.", "Pick the smallest task and start there."]);
  }

  function streak(days) {
    if (days <= 0) return "Read today and start a streak.";
    if (days === 1) return "1 day streak. Come back tomorrow to make it 2.";
    return days + " day streak. Keep it alive.";
  }

  const empty = {
    reminders: { title: "Nothing due right now", body: "Add an assignment, test or deadline and we'll remind you before it sneaks up.", action: "Add a reminder" },
    timetable: { title: "Your week is a blank page", body: "Add your first class and we'll build the week around it.", action: "Add a class" },
    reading:   { title: "No reading goals yet", body: "Choose a course and how often you want to read it. We'll handle the nudges.", action: "Set a reading goal" },
    notifications: { title: "You're all caught up", body: "New reminders will show up here when they're due.", action: "" }
  };

  const filterEmpty = {
    upcoming: { title: "Nothing due right now", body: "Add an assignment, test or deadline and we'll remind you before it sneaks up." },
    overdue:  { title: "Nothing overdue", body: "You're on top of things. Keep it up." },
    done:     { title: "Nothing ticked off yet", body: "Finished tasks will collect here so you can see how far you've come." }
  };

  const errors = {
    emailInvalid: "That email doesn't look right. Check for a missing @ or a typo.",
    emailTaken: "There's already an account with this email. Try logging in instead.",
    loginFailed: "We couldn't log you in with that email and password. Check both, or create an account.",
    endBeforeStart: "The end time has to come after the start time.",
    dateNeeded: "Pick the date for this one-off class.",
    goalDuplicate: "You already have a reading goal for that course. Edit it instead.",
    courseDuplicate: "You've already added that course.",
    courseNeeded: "Add at least one course so we know what to remind you about.",
    passwordShort: "Use at least 8 characters so your account stays safe.",
    passwordMismatch: "Those passwords don't match. Type them again.",
    required: "This one is needed before we can continue.",
    timeClash: "That time overlaps with another class. Pick a different slot or move the other one.",
    saveFailed: "We couldn't save that. Check your connection and try again."
  };

  const tips = [
    "Study in short bursts: 25 minutes on, 5 minutes off.",
    "Read the hardest course first, while your head is fresh.",
    "Explaining a topic out loud shows you what you don't know yet.",
    "Sleep before an exam beats an all-nighter almost every time.",
    "Past questions are the best practice test you can get."
  ];

  return { greeting, progress, streak, empty, filterEmpty, errors, tip: function () { return pick(tips); } };
})();
