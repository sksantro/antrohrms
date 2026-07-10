from django.utils.html import escape

COMPANY_DISPLAY_NAME = 'Antro-PAI Technologies Pvt Ltd.'
COMPANY_ADDRESS_LINE = (
    'H.No.247/Flat No. 201, 2nd Floor, Ramakrishna Niwas, '
    'Sanjeevareddy Nagar, Hyderabad, Telangana State - 500038, India'
)
COMPANY_FOOTER_ADDRESS = (
    '201, 2nd Floor, Ramakrishna Nivas, Sanjeevareddy Nagar, Hyderabad-500038'
)

LETTERHEAD_SVG = """
<svg class="offer-letter-document__top-curve" viewBox="0 0 420 160" preserveAspectRatio="none" aria-hidden="true">
  <path d="M65 0 H420 V160 C350 50 245 20 65 0Z" fill="#004bd6" />
  <path d="M15 0 C170 18 310 48 400 160" fill="none" stroke="#2d84ff" stroke-width="14" />
  <path d="M55 0 C190 18 315 55 395 160" fill="none" stroke="#ffffff" stroke-width="8" />
  <path d="M95 0 C220 22 330 65 405 160" fill="none" stroke="#0a2877" stroke-width="5" />
</svg>
"""

JOINING_DOCUMENTS = [
    (
        'Experience letter, payslips, relieving letter/ acceptance of resignation from all '
        'previous organizations – if applicable to you'
    ),
    'Attested photocopies of Original Educational certificates (Class X onwards)',
    'Recent passport size photograph soft copy taken against a white background',
    'Passport / Driving License – if applicable to you',
    'Aadhar Card',
    'PAN Card',
]


def _esc(value: str | None) -> str:
    return escape(value or '').replace('\n', '<br/>')


def build_letterhead_html() -> str:
    return f"""
    {LETTERHEAD_SVG}
    <div class="offer-letter-document__brand-box">
      <img src="/antro-pai-logo.png" alt="Antro-PAI" class="offer-letter-document__brand-logo" />
      <div class="offer-letter-document__brand-text">
        Antro-PAI<br />
        Technologies Pvt Ltd.
      </div>
    </div>
    <div class="offer-letter-document__blue-strip"></div>
    """


def _term(number: int, body: str, title: str | None = None) -> str:
    title_html = f'<b>{escape(title)}: </b>' if title else ''
    return (
        f'<div class="offer-letter-document__term">'
        f'<span class="offer-letter-document__term-number">{number}.</span>'
        f'<div class="offer-letter-document__term-content">{title_html}{body}</div>'
        f'</div>'
    )


def build_standard_terms_html(
    designation: str,
    offered_ctc: str,
    work_location: str,
) -> str:
    location = work_location or 'Hyderabad/Client Location'
    terms = [
        _term(
            1,
            f'Your position title would be designation ed as - <b>{_esc(designation)}.</b>',
            'POSITION',
        ),
        _term(
            2,
            (
                f'Your compensation details are stated below for offer documentation only.<br/>'
                f'{_esc(offered_ctc)}'
            ),
            'SALARY',
        ),
        _term(
            3,
            (
                'On joining the Company, you will be on probation for a period of Three (3) months. '
                'During probation, your progress will be reviewed by your manager on a periodic basis. '
                'Your employment may be terminated during the probation period, due to unsatisfactory performance.'
            ),
            'PROBATION',
        ),
        _term(
            4,
            (
                'You will be governed by the Service Rules and Regulations as applicable to all employees '
                'of the Company, which is in force at the time of your joining. These may be amended from '
                'time to time, and you are expected to keep yourself updated of all company policies and procedures.'
            ),
            'RULES AND REGULATIONS',
        ),
        _term(
            5,
            (
                'Workdays will be from Tuesday through Saturday for 9 hours that includes a 45-minute lunch '
                'break. These timings are at the discretion of the management and should normally consist of a '
                '45 hours&rsquo; work week. The Company reserves the right to assign you tasks in any shift, '
                'based on your specific assignment and customer geography, and needs.'
            ),
            'Working HOURS',
        ),
        _term(
            6,
            (
                'Every employee is eligible for 1.5 earned leaves after completion of every month. These leaves '
                'cannot be leveraged in probation and notice period. To take care of employees all employees will '
                'be credited with 10 days of medical leaves every year.'
            ),
            'Leaves',
        ),
        _term(
            7,
            (
                'The Company observes 8 (eight) holidays in a calendar year and allows an employee 2 (Two) optional '
                'holidays for religious or social activities, which may be availed at the time of joining, after due '
                'discussions with the manager and taking prior approval, based on work schedules.'
            ),
            'HOLIDAYS',
        ),
        _term(
            8,
            f'Your place of posting will be in <b>{_esc(location)}</b>.',
            'PLACE OF POSTING',
        ),
        _term(
            9,
            (
                'The mutual notice period between you and the Company for the termination of employment will be 60 days '
                'after completion of probation period. The Company has the sole discretion to accept your resignation. '
                'The Company also reserves the right to, at its sole discretion, substitute the giving of notice, by '
                'paying you salary in lieu of the notice period. If employee does not server notice period, Employee '
                'needs to pay notice period amount to the company as Notice period buyout.'
            ),
            'NOTICE PERIOD',
        ),
        _term(
            10,
            (
                'The Company reserves the right to immediately terminate your employment without any notice period or '
                'payment in lieu of, for'
                '<ul class="offer-letter-document__bullet-list">'
                '<li>material breach of this contract or evidence of malpractice during the hiring process.</li>'
                '<li>Non-performance reported by customer/Company management during probation</li>'
                '<li>Failure in background verification</li>'
                '<li>In the event of falsification of documents, affidavits submitted to the Company.</li>'
                '<li>Behavioral issue would be taken on highest priority as HR case.</li>'
                '<li>Any kind of company policies and ethic violation</li>'
                '</ul>'
            ),
        ),
        _term(
            11,
            (
                'You are agreed to continue employment for 1 year as per the service agreement and on successful '
                'completion of one year, notice period clause will be applicable by default. There is mutual bond '
                'between employee and Employer, where as Employee cannot leave the organization before completion of '
                'one year from actual date of joining as a permanent employee, in case employee breaches this in '
                'between there must be a penalty of 30 percent of the current CTC.'
            ),
        ),
        _term(
            12,
            (
                'During the period of your employment, you will not work directly or indirectly for any other person, '
                'firm, Company or organization, be it as a consultant, contractor, vendor, partner, part-timer or in '
                'any other capacity, whether with or without remuneration.'
            ),
            'OTHER EMPLOYMENT',
        ),
        _term(
            13,
            (
                'In case you intend to appear in examinations or courses related to your role at Antro-Pai Technologies, '
                'you are required to obtain prior written permission from your reporting manager after sharing full '
                'details of the course, time frame and schedules involved.'
            ),
            'EXAMS & COURSES',
        ),
        _term(
            14,
            (
                'While employed with Antro-PAI Technologies, you will uphold the Company&rsquo;s trust for propriety '
                'ideas and promptly disclose new inventions, improvements or discoveries made or conceived by you '
                'either alone or jointly with others.'
            ),
            'INVENTION & DISCOVERIES',
        ),
        _term(
            15,
            (
                'You will not give anyone, by word of mouth, writing, facsimile any devices or otherwise any particulars '
                'or details, which you acquire during your employment of our working systems, technical knowhow, security '
                'arrangements, administrative and or organization matters.'
            ),
            'SECRECY',
        ),
        _term(
            16,
            (
                'Please note that the terms and conditions of your service contract as stipulated here-to-fore or to be '
                'intimated hereafter, are to be treated as strictly confidential and you are not to divulge its contents '
                'to any employee of the Company/person connected with the Company.'
            ),
            'GENERAL',
        ),
    ]
    return ''.join(terms)


def build_joining_documents_html() -> str:
    items = ''.join(f'<li>{escape(item)}</li>' for item in JOINING_DOCUMENTS)
    return f'<ol class="offer-letter-document__docs-list">{items}</ol>'
