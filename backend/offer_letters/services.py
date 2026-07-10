from django.utils import timezone
from django.utils.html import escape

from offer_letters.models import OfferLetter
from offer_letters.template_content import (
    COMPANY_ADDRESS_LINE,
    COMPANY_DISPLAY_NAME,
    COMPANY_FOOTER_ADDRESS,
    build_joining_documents_html,
    build_letterhead_html,
    build_standard_terms_html,
)
from settings_app.models import CompanySettings


def mark_offer_expired_if_needed(offer: OfferLetter) -> bool:
    if offer.refresh_expiry_status():
        offer.save(update_fields=['status', 'updated_at'])
        return True
    return False


def _esc(value: str | None) -> str:
    return escape(value or '')


def build_offer_document_html(offer: OfferLetter, company_name: str | None = None) -> str:
    company = company_name or CompanySettings.get_settings().company_name or COMPANY_DISPLAY_NAME
    letter_date = timezone.localdate().strftime('%d %B %Y')
    joining_date = offer.joining_date.strftime('%d-%B-%Y')
    valid_till = offer.offer_valid_till.strftime('%d-%B-%Y')
    work_location = offer.work_location or 'Hyderabad'
    letterhead = build_letterhead_html()
    standard_terms = build_standard_terms_html(
        offer.designation,
        offer.offered_ctc,
        offer.work_location,
    )
    joining_docs = build_joining_documents_html()
    additional_terms = ''
    if offer.terms_and_conditions.strip():
        additional_terms = f"""
        <h2 class="offer-letter-document__section-title">Additional Terms</h2>
        <div class="offer-letter-document__richtext">{_esc(offer.terms_and_conditions).replace(chr(10), '<br/>')}</div>
        """

    display_company = COMPANY_DISPLAY_NAME if company == CompanySettings.get_settings().company_name else company

    return f"""
    <article class="offer-letter-document offer-letter-document--live">
      <section class="offer-letter-document__page offer-letter-document__page--one">
        <header class="offer-letter-document__letterhead">
          {letterhead}
        </header>

        <h1 class="offer-letter-document__title">Letter of Employment</h1>

        <div class="offer-letter-document__top-info">
          <div>
            <b>To,</b><br />
            <b>{_esc(offer.candidate_name)}</b><br />
            <b>{_esc(work_location)}</b>
          </div>
          <b>{letter_date}</b>
        </div>

        <p class="offer-letter-document__offer-ref">Offer Ref: {_esc(offer.offer_id)} | Valid Till: {valid_till}</p>

        <div class="offer-letter-document__body">
          <p><b>Dear Antronian (The Employee),</b></p>
          <p>
            Congratulations! Based on your discussions with us, we are pleased to offer you a position with
            <b> {_esc(display_company)} </b>
            (&ldquo;the Company&rdquo;), {COMPANY_ADDRESS_LINE}, with effect from <b>Date ({joining_date}).</b>
          </p>
          <p>
            We wish to share details which if you accept, will govern the terms and conditions of your employment with us.
            Please confirm your acceptance of the offer before <b>Date ({valid_till})</b>, failing which this offer is
            considered null and void.
          </p>
          <p>
            You are advised to read this Offer letter carefully and if the terms and conditions are acceptable to you,
            please sign the duplicate copy as a token of your having understood and accepted the offer. You are required
            to share the following documents and contact the HR department on or before the date of your joining:
          </p>

          {joining_docs}

          <h2 class="offer-letter-document__section-title">TERMS &amp; CONDITIONS OF EMPLOYMENT</h2>
          {standard_terms}
          {additional_terms}

          <p>
            This offer for employment given to you by the Company is subject to successful completion of background
            investigation, verification and authentication of all facts, details and documents submitted by you.
          </p>
          <p>
            The Company reserves the right to change the terms and conditions of employment and its policies and
            procedures at any time.
          </p>
          <p>
            During your employment, you will diligently, efficiently, honestly, faithfully and to the best of your
            ability devote your whole time and attention to promote the interest of the Company.
          </p>
          <p>We are quite excited to have you join the Company and wish you a long and successful career with us.</p>
          <p>By signing this you are agreeing to all the terms and conditions mentioned in this letter.</p>
        </div>

        <footer class="offer-letter-document__footer">
          <p>Yours sincerely,</p>
          <div class="offer-letter-document__signature-row offer-letter-document__signature-row--names">
            <p><b>For {_esc(display_company)}</b></p>
            <p><b>Employee Name:</b> {_esc(offer.candidate_name)}</p>
          </div>
          <p class="offer-letter-document__signature-label"><b>Employee Signature:</b></p>
          <div class="offer-letter-document__signature-row offer-letter-document__signature-row--sign">
            <p><b>(Hiring Manager)</b></p>
            <p><b>Date:</b> ____________________</p>
          </div>
          <p class="offer-letter-document__footer-address">{COMPANY_FOOTER_ADDRESS}</p>
        </footer>
      </section>
    </article>
    """


def send_offer_letter(offer: OfferLetter) -> dict:
    mark_offer_expired_if_needed(offer)
    if offer.status not in {OfferLetter.Status.DRAFT, OfferLetter.Status.SENT}:
        raise ValueError('Only draft or sent offers can be sent.')

    offer.status = OfferLetter.Status.SENT
    offer.sent_at = timezone.now()
    offer.save(update_fields=['status', 'sent_at', 'updated_at'])

    return {
        'detail': (
            'Offer letter marked as sent. Email delivery is not configured yet; '
            'share the acceptance link with the candidate manually.'
        ),
        'email_sent': False,
        'status': offer.status,
    }


def accept_offer_letter(offer: OfferLetter) -> OfferLetter:
    mark_offer_expired_if_needed(offer)
    if offer.status != OfferLetter.Status.SENT:
        raise ValueError('This offer cannot be accepted in its current status.')
    if offer.offer_valid_till < timezone.localdate():
        offer.status = OfferLetter.Status.EXPIRED
        offer.save(update_fields=['status', 'updated_at'])
        raise ValueError('This offer has expired.')

    company_name = CompanySettings.get_settings().company_name
    offer.status = OfferLetter.Status.ACCEPTED
    offer.accepted_at = timezone.now()
    offer.accepted_document_snapshot = build_offer_document_html(offer, company_name)
    offer.save(
        update_fields=[
            'status',
            'accepted_at',
            'accepted_document_snapshot',
            'updated_at',
        ],
    )
    try:
        from onboarding.services import ensure_onboarding_for_accepted_offer

        ensure_onboarding_for_accepted_offer(offer)
    except Exception:
        pass
    return offer


def reject_offer_letter(offer: OfferLetter) -> OfferLetter:
    mark_offer_expired_if_needed(offer)
    if offer.status != OfferLetter.Status.SENT:
        raise ValueError('This offer cannot be rejected in its current status.')

    offer.status = OfferLetter.Status.REJECTED
    offer.rejected_at = timezone.now()
    offer.save(update_fields=['status', 'rejected_at', 'updated_at'])
    return offer


def cancel_offer_letter(offer: OfferLetter) -> OfferLetter:
    if offer.status in {
        OfferLetter.Status.ACCEPTED,
        OfferLetter.Status.REJECTED,
        OfferLetter.Status.CANCELLED,
    }:
        raise ValueError('This offer cannot be cancelled.')

    offer.status = OfferLetter.Status.CANCELLED
    offer.save(update_fields=['status', 'updated_at'])
    return offer
