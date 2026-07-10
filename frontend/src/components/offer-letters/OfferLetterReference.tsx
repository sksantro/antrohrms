import type { ReactNode } from 'react';

import antroLogo from '../../assets/antro-pai-logo.png';
import './OfferLetterReference.css';

const offerData = {
  candidateName: 'Modala Pavani Sagar',
  location: 'Hyderabad',
  offerDate: '01 July 2026',
  joiningDate: '01-July-2026',
  acceptanceDate: '01-July-2026',
  designation: 'Senior Pre Sales Executive',
  salaryDesignation: 'Associate Software Engineer',
  ctc: '5,40,000/-',
  ctcWords: 'Rupees five Lakhs Fourty thousand only',
  companyAddress:
    'H.No.247/Flat No. 201, 2nd Floor, Ramakrishna Niwas, Sanjeevareddy Nagar, Hyderabad, Telangana State - 500038, India',
};

interface TermProps {
  number: number;
  title?: string;
  children: ReactNode;
}

export function OfferLetterReference() {
  const d = offerData;

  return (
    <div className="offer-letter-reference-root">
      <div className="offer-wrapper">
        <section className="offer-page page-one">
          <Header />

          <h1 className="letter-title">Letter of Employment</h1>

          <div className="top-info">
            <div>
              <b>To,</b>
              <br />
              <b>Ms. {d.candidateName}.</b>
              <br />
              <b>{d.location}</b>
            </div>
            <b>{d.offerDate}</b>
          </div>

          <p>
            <b>Dear Antronian (The Employee),</b>
          </p>

          <p>
            Congratulations! Based on your discussions with us, we are pleased to offer you a position with
            <b> Antro-PAI Technologies Pvt Ltd. </b>
            (&ldquo;the Company&rdquo;), {d.companyAddress}, with effect from <b>Date ({d.joiningDate}).</b>
          </p>

          <p>
            We wish to share details which if you accept, will govern the terms and conditions of your employment with us.
            Please confirm your acceptance of the offer before <b>Date ({d.acceptanceDate})</b>, failing which this offer is
            considered null and void.
          </p>

          <p>
            You are advised to read this Offer letter carefully and if the terms and conditions are acceptable to you,
            please sign the duplicate copy as a token of your having understood and accepted the offer. You are required
            to share the following documents and contact the HR department on or before the date of your joining:
          </p>

          <ol className="doc-list">
            <li>
              Experience letter, payslips, relieving letter/ acceptance of resignation from all previous organizations
              – if applicable to you
            </li>
            <li>Attested photocopies of Original Educational certificates (Class X onwards)</li>
            <li>Recent passport size photograph soft copy taken against a white background</li>
            <li>Passport / Driving License – if applicable to you</li>
            <li>Aadhar Card</li>
            <li>PAN Card</li>
          </ol>

          <h2 className="section-title">TERMS &amp; CONDITIONS OF EMPLOYMENT</h2>

          <Term number={1} title="POSITION">
            Your position title would be designation ed as - <b>{d.designation}.</b>
          </Term>

          <Term number={2} title="SALARY">
            Your title and position will be {d.salaryDesignation}, and your base salary will be <b>{d.ctc}</b>
            <br />
            <b>( {d.ctcWords} )per Annum.</b>
          </Term>

          <Term number={3} title="PROBATION">
            On joining the Company, you will be on probation for a period of Three (3) months. During probation, your
            progress will be reviewed by your manager on a periodic basis. Your employment may be terminated during
            the probation period, due to unsatisfactory performance.
          </Term>
        </section>

        <section className="offer-page normal-page">
          <Term number={4} title="RULES AND REGULATIONS">
            You will be governed by the Service Rules and Regulations as applicable to all employees of the Company,
            which is in force at the time of your joining. These may be amended from time to time, and you are expected
            to keep yourself updated of all company policies and procedures.
          </Term>

          <Term number={5} title="Working HOURS">
            Workdays will be from Tuesday through Saturday for 9 hours that includes a 45-minute lunch break. These
            timings are at the discretion of the management and should normally consist of a 45 hours&rsquo; work week.
            The Company reserves the right to assign you tasks in any shift, based on your specific assignment and
            customer geography, and needs.
          </Term>

          <Term number={6} title="Leaves">
            Every employee is eligible for 1.5 earned leaves after completion of every month. These leaves cannot be
            leveraged in probation and notice period. To take care of employees all employees will be credited with
            10 days of medical leaves every year.
          </Term>

          <Term number={7} title="HOLIDAYS">
            The Company observes 8 (eight) holidays in a calendar year and allows an employee 2 (Two) optional holidays
            for religious or social activities, which may be availed at the time of joining, after due discussions with
            the manager and taking prior approval, based on work schedules.
          </Term>

          <Term number={8} title="PLACE OF POSTING">
            Your place of posting will be in Hyderabad/Client Location.
          </Term>

          <Term number={9} title="NOTICE PERIOD">
            The mutual notice period between you and the Company for the termination of employment will be 60 days
            after completion of probation period. The Company has the sole discretion to accept your resignation.
            The Company also reserves the right to, at its sole discretion, substitute the giving of notice, by paying
            you salary in lieu of the notice period. If employee does not server notice period, Employee needs to pay
            notice period amount to the company as Notice period buyout.
          </Term>

          <Term number={10}>
            The Company reserves the right to immediately terminate your employment without any notice period or payment
            in lieu of, for
            <ul className="bullet-list">
              <li>material breach of this contract or evidence of malpractice during the hiring process.</li>
              <li>Non-performance reported by customer/Company management during probation</li>
              <li>Failure in background verification</li>
              <li>In the event of falsification of documents, affidavits submitted to the Company.</li>
              <li>Behavioral issue would be taken on highest priority as HR case.</li>
              <li>Any kind of company policies and ethic violation</li>
            </ul>
          </Term>

          <Term number={11}>
            You are agreed to continue employment for 1 year as per the service agreement and on successful completion
            of one year, notice period clause will be applicable by default. There is mutual bond between employee and
            Employer, where as Employee cannot leave the organization before completion of one year from actual date of
            joining as a permanent employee, in case employee breaches this in between there must be a penalty of
            30 percent of the current CTC.
          </Term>

          <Term number={12} title="OTHER EMPLOYMENT">
            During the period of your employment, you will not work directly or indirectly for any other person, firm,
            Company or organization, be it as a consultant, contractor, vendor, partner, part-timer or in any other
            capacity, whether with or without remuneration.
          </Term>
        </section>

        <section className="offer-page normal-page">
          <Term number={13} title="EXAMS & COURSES">
            In case you intend to appear in examinations or courses related to your role at Antro-Pai Technologies,
            you are required to obtain prior written permission from your reporting manager after sharing full details
            of the course, time frame and schedules involved.
          </Term>

          <Term number={14} title="INVENTION & DISCOVERIES">
            While employed with Antro-PAI Technologies, you will uphold the Company&rsquo;s trust for propriety ideas and
            promptly disclose new inventions, improvements or discoveries made or conceived by you either alone or
            jointly with others.
          </Term>

          <Term number={15} title="SECRECY">
            You will not give anyone, by word of mouth, writing, facsimile any devices or otherwise any particulars
            or details, which you acquire during your employment of our working systems, technical knowhow, security
            arrangements, administrative and or organization matters.
          </Term>

          <Term number={16} title="GENERAL">
            Please note that the terms and conditions of your service contract as stipulated here-to-fore or to be
            intimated hereafter, are to be treated as strictly confidential and you are not to divulge its contents to
            any employee of the Company/person connected with the Company.
          </Term>

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

          <div className="signature-row">
            <div>
              <p>Yours sincerely,</p>
              <p>
                <b>For Antro-PAI Technologies Pvt Ltd.</b>
              </p>
              <br />
              <br />
              <p>
                <b>(Hiring Manager)</b>
              </p>
            </div>

            <div>
              <p>
                <b>Employee Name:</b> {d.candidateName}
              </p>
              <br />
              <p>
                <b>Employee Signature:</b>
              </p>
              <br />
              <p>
                <b>Date:</b> 01-07-2026.
              </p>
            </div>
          </div>

          <footer className="footer-address">
            201, 2nd Floor, Ramakrishna Nivas, Sanjeevareddy Nagar, Hyderabad-500038
          </footer>
        </section>
      </div>
    </div>
  );
}

function Header() {
  return (
    <>
      <svg className="top-curve" viewBox="0 0 420 160" preserveAspectRatio="none" aria-hidden>
        <path d="M65 0 H420 V160 C350 50 245 20 65 0Z" fill="#004bd6" />
        <path d="M15 0 C170 18 310 48 400 160" fill="none" stroke="#2d84ff" strokeWidth="14" />
        <path d="M55 0 C190 18 315 55 395 160" fill="none" stroke="#ffffff" strokeWidth="8" />
        <path d="M95 0 C220 22 330 65 405 160" fill="none" stroke="#0a2877" strokeWidth="5" />
      </svg>

      <div className="brand-box">
        <img src={antroLogo} alt="Antro-PAI Logo" className="brand-logo" />
        <div className="brand-text">
          Antro-PAI
          <br />
          Technologies Pvt Ltd.
        </div>
      </div>

      <div className="blue-strip" />
    </>
  );
}

function Term({ number, title, children }: TermProps) {
  return (
    <div className="term">
      <span className="term-number">{number}.</span>
      <div className="term-content">
        {title && <b>{title}: </b>}
        {children}
      </div>
    </div>
  );
}
