interface OfferLetterTemplateProps {
  html: string;
  className?: string;
}

export function OfferLetterTemplate({ html, className = '' }: OfferLetterTemplateProps) {
  if (!html?.trim()) {
    return (
      <div className={`offer-letter-preview offer-letter-preview--empty ${className}`.trim()}>
        <p>Offer letter preview is not available.</p>
      </div>
    );
  }

  return (
    <div
      className={`offer-letter-preview ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
