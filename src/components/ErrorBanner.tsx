interface Props {
  message: string
  onRetry?: () => void
}

/**
 * A11 requires the user gets a message they can act on, not a white
 * screen or a console error. Every failure path in this app routes
 * here instead of failing silently.
 */
export default function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div className="error-banner">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="retry-btn">
          Retry
        </button>
      )}
    </div>
  )
}
