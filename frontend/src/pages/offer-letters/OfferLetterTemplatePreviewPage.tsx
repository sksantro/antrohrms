import { Link } from 'react-router-dom';

import { OfferLetterReference } from '../../components/offer-letters/OfferLetterReference';
import { PageHeader } from '../../components/PageHeader';
import { ButtonLink, Card } from '../../components/ui';

export function OfferLetterTemplatePreviewPage() {
  return (
    <div className="offer-letter-template-preview-page">
      <PageHeader
        title="Offer Letter Template Preview"
        description="Standalone design check using your React/CSS reference. The live offer preview is unchanged."
      />

      <Card wide className="offer-letter-template-preview-page__notice">
        <p>
          This page is for comparing the letterhead and layout against your PDF sample. Edit{' '}
          <code>OfferLetterReference.tsx</code> and <code>OfferLetterReference.css</code> to refine the design.
        </p>
        <div className="offer-letter-template-preview-page__actions">
          <ButtonLink to="/hr/offer-letters" variant="secondary">
            Back to Offer Letters
          </ButtonLink>
          <Link to="/hr/offer-letters" className="muted">
            Live preview still uses the backend HTML template
          </Link>
        </div>
      </Card>

      <OfferLetterReference />
    </div>
  );
}
