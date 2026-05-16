import { Globe, ExternalLink } from "lucide-react"

const footerLinks = [
  { label: "Documentation", href: "#" },
  { label: "API Reference", href: "#" },
  { label: "Changelog", href: "#" },
  { label: "Status", href: "#" },
]

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden">
            <img src="/logo.svg" alt="Nexus" className="h-7 w-7" />
          </div>
          <span className="font-heading text-sm font-semibold">Nexus</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          {footerLinks.map((link) => (
            <a key={link.label} href={link.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <a href="#" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Website">
            <Globe className="h-4 w-4" />
          </a>
          <a href="#" className="text-muted-foreground transition-colors hover:text-foreground" aria-label="External Link">
            <ExternalLink className="h-4 w-4" />
          </a>
          <span className="text-xs text-muted-foreground">© 2026 Nexus</span>
        </div>
      </div>
    </footer>
  )
}
