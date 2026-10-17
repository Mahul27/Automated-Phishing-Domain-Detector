// Helper utilities to calculate risk level labels and colors from a numeric risk score (0-100).

// Converts a numeric score into a risk level: "High", "Medium", or "Low"
export function getRiskLevel(score) {
  if (score >= 75) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

// Returns a display color ("red", "orange", or "green") matching the risk level
export function getRiskColor(score) {
  if (score >= 75) return "red";
  if (score >= 40) return "orange";
  return "green";
}

