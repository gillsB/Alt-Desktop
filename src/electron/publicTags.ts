//TODO when these are implemented in UI separate out the different types where it should only have 1
// ex: type (video image animated). And make these like a dropdown or some other selector.
// Actually maybe put all of them into sections like "Theme" "Aesthetic" "Mood" etc.
export const PUBLIC_TAG_CATEGORIES = [
  {
    name: "Type",
    tags: ["Video", "Image", "Animated"],
  },
  {
    name: "Aspect Ratio",
    tags: ["16:9", "21:9", "32:9", "Portrait"],
  },
  {
    name: "Resolution",
    tags: ["4K+", "1440", "1080"],
  },
  {
    name: "Theme",
    tags: [
      "Animal",
      "Anime",
      "Cars",
      "City",
      "Fantasy",
      "Girl",
      "Guy",
      "Landscape",
      "Ocean",
      "Sci-Fi",
      "Space",
    ],
  },
  {
    name: "Other",
    tags: ["loop", "low-motion"],
  },
];
