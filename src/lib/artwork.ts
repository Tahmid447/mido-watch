export function imageUrl(
  path: string | null | undefined,
  size: "w342" | "w500" | "w780" | "w1280" | "w92",
) {
  return path && /^\/[A-Za-z0-9_.-]+$/.test(path)
    ? `https://image.tmdb.org/t/p/${size}${path}`
    : null;
}
export function imageSet(path: string | null | undefined, backdrop = false) {
  return path
    ? backdrop
      ? `${imageUrl(path, "w780")} 780w, ${imageUrl(path, "w1280")} 1280w`
      : `${imageUrl(path, "w342")} 342w, ${imageUrl(path, "w500")} 500w, ${imageUrl(path, "w780")} 780w`
    : undefined;
}
