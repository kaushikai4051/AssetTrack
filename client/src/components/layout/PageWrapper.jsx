import { cn } from '@/lib/utils'

export default function PageWrapper({ title, description, actions, children, className }) {
  return (
    <div className={cn('space-y-6', className)}>
      {(title || actions) && (
        <div className="flex items-start justify-between">
          <div>
            {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
