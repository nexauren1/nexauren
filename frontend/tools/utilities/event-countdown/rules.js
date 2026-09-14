// Nexauren Event Countdown — tool-specific limits.
// The common system must not assume these rules apply to other tools.

export const eventCountdownRules = {
  free: {
    maxEvents: 3,
    allowedThemes: ["default", "conference", "birthday", "sale"],
    statistics: false
  },
  pro: {
    maxEvents: 20,
    allowedThemes: [
      "default", "conference", "wedding", "birthday", "sale",
      "launch", "webinar", "survey", "ocean", "sunset", "mint"
    ],
    statistics: true
  },
  premium: {
    maxEvents: Infinity,
    allowedThemes: [
      "default", "conference", "wedding", "birthday", "sale",
      "launch", "webinar", "survey", "ocean", "sunset", "mint"
    ],
    statistics: true
  }
};

export function getEventCountdownRules(plan) {
  return eventCountdownRules[String(plan || "free").toLowerCase()] || eventCountdownRules.free;
}
