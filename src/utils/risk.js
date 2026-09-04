export function getRiskLevel(score) {
  if (score >= 75) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function getRiskColor(score) {
  if (score >= 75) return "red";
  if (score >= 40) return "orange";
  return "green";
}
