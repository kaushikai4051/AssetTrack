export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="shrink-0 border-t border-border bg-background px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>© {year} AssetTrack — Personal Finance Manager</span>
      <div className="flex items-center gap-4">
        <span>All data stored locally &amp; privately</span>
        <span className="hidden sm:inline">·</span>
        <a
          href="mailto:support@assettrack.app"
          className="hidden sm:inline hover:text-foreground transition-colors"
        >
          Support
        </a>
      </div>
    </footer>
  )
}
