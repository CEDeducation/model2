import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OpenLab Research Workspace",
    short_name: "OpenLab",
    description: "A connected research workspace for experiments, biological records, inventory and molecular biology.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#173f35",
    icons: [{ src: "/openlab-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  }
}
