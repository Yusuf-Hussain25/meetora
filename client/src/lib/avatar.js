// Initials and a stable gradient per name, used by avatars without a photo.
const GRADIENTS = [
  "linear-gradient(135deg,#34d399,#0d9488)",
  "linear-gradient(135deg,#22d3ee,#2563eb)",
  "linear-gradient(135deg,#a3e635,#16a34a)",
  "linear-gradient(135deg,#fbbf24,#ea580c)",
  "linear-gradient(135deg,#f472b6,#9333ea)",
  "linear-gradient(135deg,#818cf8,#0ea5e9)",
];

export const initialsOf = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

export const gradientFor = (seed = "") => {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};
